# Meta AI (`metaai`) over the Responses dialect

Vendor `metaai` ("Meta AI"; the product is the Meta Model API at dev.meta.ai) serves the Muse models at `https://api.meta.ai/v1` behind a bearer key. big-AGI drives every Meta model over the OpenAI Responses dialect (`chatGenerate.dispatch.ts`, `RESPONSES_ONLY_DIALECTS`), reusing `aixToOpenAIResponses` (Meta row in `_RSP_DIALECT_QUIRKS`) and `createOpenAIResponsesEventParser('metaai')`; `metaai` is one of the `AixWire_Vendors.RSP_VENDORS` (`aix.wiretypes.ts`), the Responses vendors that share the wire format but keep a private `_vnd` namespace for continuity state. Everything below was measured on the wire on 2026-09-02; docs are `https://dev.meta.ai/docs/<page>.md` (index `docs/llms.txt`) and disagree with the wire where marked.

## Catalog

- `GET /v1/models` lists 7 ids with `created: 0` on all and no type/modality field. Chat: `muse-spark-1.3|1.2|1.1` plus `-contributor` twins of 1.3 and 1.2. Image output: `muse-image-1.0`. ASR only: `muse-voice-transcribe-1.0` (404 `model_not_found` on `/v1/responses`, filtered by prefix).
- Spark: 1,048,576 context, text/image/video/PDF/audio in (1.3 audio degraded), text out. Standard $1.25 in / $4.25 out / $0.15 cached per 1M; Contributor $0.10 / $0.20 / $0.002 and Meta trains on prompts and completions (hidden by default; documented 100 RPM / 3M TPM vs 3,000 / 4M per team on Standard - the wire header reported 150 RPM on the Contributor ids). Web search +$2.50 per 1K queries. Muse Image $0.01 per image, aspect ratio only.
- Release dates are editorial (Spark 1.1 2026-07-09, Muse Image 2026-07-07, 1.2 2026-08-05, 1.3 2026-09-02); `/llms:update-models-metaai` holds the source list.

## Request contract

- Unknown top-level parameters 400 (`unknown parameter X`); unknown nested keys are ignored. `seed`, `stop`, `n`, `logit_bias`, `response_format`, top-level `verbosity`, `conversation` all 400. The adapter's zod strip keeps the body clean.
- `tool_choice`: only `auto` (`none`, `required`, named 400). Tools policy `any` degrades to `auto` for this dialect.
- `truncation`: only `disabled` (`auto` 400, schema notwithstanding).
- `reasoning.effort`: `minimal|low|medium|high|xhigh`. `none` parses but 400s on every Spark; `max` is not in the enum (announced for 1.3). Omitted = `high` - expensive on trivial prompts (95-250 reasoning tokens for "pong"). `reasoning.summary` `auto|concise|detailed` accepted; summaries are often `[]`. No raw reasoning text ever.
- `max_output_tokens` >= 16 (the adapter floors it); reasoning shares the budget - a tight cap returns `status: incomplete` with an EMPTY `output[]`. No enforced ceiling below 1M.
- `store` defaults to TRUE upstream. The adapter sends `store: false` + `include: ['reasoning.encrypted_content']`, the documented stateless path. `include` + `previous_response_id` is a 400 - never combine.
- Accepted: `instructions`, `temperature` 0..2 (2.0 is degenerate: rambling `incomplete` replies and an occasional 500 `internal server error`; the sweep records 0..1.5 as reliable), `top_p` (0,1], `metadata` (<= 16 pairs), `user`, `prompt_cache_key`, `safety_identifier`, `parallel_tool_calls`, `max_tool_calls`, `text.verbosity`, `service_tier` (normalized to `auto`). Spark is tuned for temperature 1.0 (`initialTemperature`).
- Function tools: flat `{type: 'function', name, parameters}`, `strict` defaults to false (the schema page says true - wrong), names take at most one dot. `web_search` takes `search_context_size` and `user_location`; the adapter's `external_web_access` is tolerated, `filters.allowed_domains` 400s. `include: ['web_search_call.action.sources']` populates `action.sources`, which the parser reads. `code_interpreter`, `custom`, and `image_generation` on Spark 400.
- Structured output: `text.format` json_schema / json_object, Responses-only.
- Tool pairing is enforced both ways: an unmatched `function_call_output` and a dangling `function_call` both 400 (`_pairInteriorFunctionCalls` covers the latter).

## Stream and items

- OpenAI-shaped SSE (`event:` + `data:` lines) terminated by a bare `data: [DONE]`, which OpenAI's Responses does not send - the executor ignores it after the terminal event. Terminals: `response.completed` | `response.incomplete` | `response.failed`; a top-level `error` event can arrive mid-stream.
- `response.output_text.done` is not reliably emitted; `content_part.done` / `output_item.done` close text. `response.in_progress` repeats once per model iteration in tool loops (DEV diff warning only).
- Parallel function calls and web searches stream interleaved (item N+1 opens before item N closes). The parser's item-visit state machine logs DEV mismatches but decodes every call and search.
- Reasoning items are `{type, id, encrypted_content, summary, status}` - no `content`. The streamed id is composite `rs_<response>:rs_<inner>`; `response.completed.output[].id` repeats it verbatim on single-iteration responses and drops to the bare `rs_<inner>` in multi-iteration tool loops - treat ids as opaque. Either form replays (id is optional when `encrypted_content` is present). Blobs are Meta-private: they live in the `metaai` `_vnd` namespace (`aix.wiretypes.ts`, `chat.fragments.ts`) and never cross vendors - Meta 400s on a foreign or expired item.
- Assistant preamble before tool calls carries `phase: 'commentary'`; captured and resent.
- `web_search_call.action.open_page` may lack `url` on failed opens (schema made nullish); web search items can carry `status: 'failed'`.
- `muse-image-1.0` streams no item events (`response.created` -> `response.completed` only): curated `LLM_IF_HOTFIX_NoStream`, the NS parser reads `image_generation_call.result` (base64 WebP, no `output_format` echo - mime sniffed from the base64 magic). It accepts only the `image_generation` tool.

## Errors, headers, CORS

- Envelope `{error: {code, message, param, type}}`; `code` is null on validation errors - branch on `type` + HTTP status. 401 `invalid_api_key` for both a wrong and a missing key; unknown model is 404 `model_not_found`; 429 carries `Retry-After`; 504 affects non-streaming only.
- `x-ratelimit-{limit,remaining}-{requests,tokens}` on Spark generations only; limits are per team and per tier. `x-request-id` on most responses.
- CORS: `access-control-allow-origin: *`, `allow-headers: *`, methods `GET,POST,DELETE,OPTIONS`, on preflights and on error responses - browser-direct (CSF) works. No `expose-headers`, so rate-limit headers are invisible client-side.

## Deliberately not wired

- Resume / delete (`GET`/`DELETE /v1/responses/{id}`): served OpenAI-identically, but the client lever is globally off and the adapter's `include` gate is coupled to `store: false`.
- `tool_search` + `namespace` tools, `context_management` / compaction items, `frequency_penalty` / `presence_penalty`, `prompt_cache_retention`, `background`, `POST /v1/responses/input_tokens` (its count includes ~157 injected scaffolding tokens and is not comparable to `usage.input_tokens`).
- `input_video`, `input_file` (PDF), `input_audio` parts: AIX has no native parts for them yet, so those attachments degrade to text.

Maintenance: `/llms:update-models-metaai` (catalog, prices), `tools/develop/aix-protocol-lab` flavor `metaai-responses` (protocol), `tools/develop/llm-parameter-sweep` dialect `metaai` + `/llms:verify-parameters metaai` (parameter acceptance).
