# OpenRouter over the Responses dialect

🧭 Direction record for switching vendor `openrouter` from Chat Completions to `POST /api/v1/responses`. The switch is one-way: the dialect serves either protocol, never both. This page is the parity record: every OpenRouter customization in the Chat Completions path (`openai.chatCompletions.ts`, `openai.parser.ts`, `chatGenerate.dispatch.ts`) against its measured Responses counterpart. Everything below was measured on the wire on 2026-09-09 (~150 requests, 20 models, 8 vendors), most requests with `debug: { echo_upstream_body: true }` (streaming only) to read the body OpenRouter sends upstream. Docs: `https://openrouter.ai/docs/<page>.md`, index `docs/llms.txt`; the reference schema is `api/api-reference/responses/create-a-response.md`.

## Protocol

- OpenRouter implements the Open Responses spec (openresponses.org): OpenAI Responses plus vendor-prefixed items (`openrouter:web_search`, `openrouter:shell`, `openrouter:image_generation`) and reasoning items that may carry raw `content`. OpenRouter adds `format` and `signature` on reasoning items beyond the spec.
- Stateless only: `store: true` and a non-null `previous_response_id` 400 (`invalid_prompt`). No resume or delete handles; force `enableResumability` off for the dialect. `/responses/compact` 404s.
- Wire: standard SSE, `: ` comment lines (same demuxer), `response.created | in_progress | output_item.added | content_part.* | output_text.delta | function_call_arguments.* | output_item.done | completed | incomplete`, then `data: [DONE]`. Usage always on the terminal event (`input_tokens_details.cached_tokens`, `cache_write_tokens`, `output_tokens_details.reasoning_tokens`, `cost` number, `cost_details`, `is_byok`). The docs' `response.done` and `content_part.delta` examples are stale.
- Item ids are synthetic (`rs_tmp_*`, `msg_tmp_*`, `fc_tmp_*`, `ig_tmp_*`), opaque, per response.
- Errors before the stream are JSON with numeric `code` and `metadata.raw` (upstream cause), the same shape `_forwardOpenRouterDataError` unwraps today, also with `stream: true`. Schema failures are opaque: `{ code: 'invalid_prompt', message: 'Invalid Responses API request' }`, sometimes with validator detail in `metadata.raw`. Streamed failures: `response.failed` plus a top-level `error_type` (documented, not triggered).
- Unknown top-level params are forwarded and 400 upstream (`foo_bar` reached OpenAI). `provider.require_parameters: true` filters endpoints instead ("No endpoints found that can handle the requested parameters").
- Stability: 15/15 controlled streams completed; two truncated streams (no terminal event) in one ~40-request concurrent burst. TTFB parity with Chat Completions.
- `X-OpenRouter-Metadata: enabled` adds `openrouter_metadata` (selected provider, strategy, region, attempt, `generation_time`, pipeline) to the body, on `response.completed` when streaming. The header is NOT in the CORS allow-list (preflight lists `X-Openrouter-Title`, `X-Title`, `X-Openrouter-Categories`, `HTTP-Referer`, `X-Session-Id`); `X-Provider-Name` is CORS-exposed but never sent. The body has no `provider` field. Server path keeps the provider label via the header; CSF loses it.

## Parity matrix

Status: ok = same shape works; remap = works with a different shape; port = our code must change; loss = no equivalent.

| Chat Completions customization | Responses equivalent | Status |
|---|---|---|
| Sticky `session_id` (adapter) | Same field. 3/3 same provider with it, 1/3 without (DeepSeek, 15 endpoints) | ok |
| `provider.require_parameters` (dispatch) | Same | ok |
| App attribution headers, CSF | Same; preflight 204 `*` for our header set | ok |
| `provider` in body (parser) | Metadata header only, see Protocol | port; loss under CSF |
| Anthropic effort via top-level `verbosity` | Top-level `verbosity` is dropped for Claude and 400s for GPT ("moved to text.verbosity"). `reasoning.effort` maps to `output_config.effort` (low, high, xhigh, max verified); `text.verbosity` maps there too and to OpenAI `text.verbosity` | remap |
| Anthropic `reasoning: { enabled, max_tokens }` | Same; upstream `thinking: { type: 'enabled', budget_tokens }` | ok |
| Anthropic `reasoning: { enabled: true }` | Same; upstream `thinking: { type: 'adaptive' }`. Effort on a budget model (Haiku 4.5 `high`) becomes `budget_tokens: 6400` | ok |
| Delete `temperature` with thinking | OpenRouter drops it upstream itself. Keeping the delete is harmless | ok |
| Fable `enabled: false` rejection | Same 400 "Reasoning is mandatory for this endpoint" (also Kimi K2.7). Sonnet 5 disables cleanly (`thinking: { type: 'disabled' }`) | ok |
| Gemini `reasoning: { enabled: true, max_tokens }` | Same; upstream `thinkingBudget`. Quirk: `max_tokens` WITHOUT `enabled` becomes `thinkingBudget: 0` on 2.5 Flash and 400 "mandatory" on 2.5 Pro and 3.x (Chat Completions maps it correctly). Always send `enabled: true` | ok |
| Gemini effort level | `thinkingLevel` on 3.x; `thinkingBudget: 24576` for `high` on 2.5 | ok |
| OpenAI-compatible `reasoning: { enabled, effort }` | Same. `none` passes; `minimal` becomes `low` on GPT-5.5; `max` passes on GPT-5.6; DeepSeek receives `reasoning_effort` | ok |
| `reasoning.mode: 'pro'` | Same; response `model` reports the `-pro` id | ok |
| `reasoning_effort` dedupe | Not needed, only `reasoning` exists | ok |
| `reasoning_details[]` parsing | Reasoning items (see Reasoning items). Our parser drops `response.reasoning_text.delta` | port |
| Reasoning replay | Chat Completions never replayed `reasoning_details`. Responses accepts whole items back, translates across vendors, tolerates stripped history | port, gain |
| `cache_control` on content parts | Block-level `cache_control` is accepted and INERT (0 cache writes on a 4.7k prompt, every placement). Working shapes: `prompt_cache_breakpoint: { mode: 'explicit' }` on `input_text` blocks of system, developer and user messages (4706 written, 4687 read); top-level `cache_control: { type: 'ephemeral' }` auto-marks the last cacheable block (4697 written, read on repeat). Markers on assistant `output_text` are ignored | remap |
| System prompt breakpoint | `instructions` cannot carry a marker. Send the system prompt as a system-role message item (OpenRouter maps it to Anthropic `system`), or rely on the top-level marker | remap |
| Max-4 breakpoint trim | Still required: 5 markers return Anthropic's "A maximum of 4 blocks with cache_control" 400 | ok |
| Fable forced `tool_choice` degrade | Same 400 on `required` and `{ type: 'function' }`; `none` and `auto` fine | ok |
| `plugins: [{ id: 'web' }]` | Accepted, deprecated by OpenRouter. `tools: [{ type: 'openrouter:web_search', engine?, max_results? }]` works on Claude and DeepSeek: one `openrouter:web_search` item (`action`, `id`, `status`) then `url_citation` annotations via `response.output_text.annotation.added` (start/end indices were 0). Bare `{ type: 'web_search' }` also works on Claude; on GPT it stays native (`web_search_call` items) | remap |
| `include: ['web_search_call.action.sources']` | Only five include values exist (`file_search_call.results`, `message.input_image.image_url`, `computer_call_output.output.image_url`, `reasoning.encrypted_content`, `code_interpreter_call.outputs`); this one 400s. Send it to OpenAI models only | OpenAI-only |
| Hosted `code_interpreter` | GPT executes (`code_interpreter_call` item). Claude accepts the tool and fabricates the output. `openrouter:shell` executes for everyone (item `openrouter:shell`) | remap |
| `modalities: ['image']` + `image_config` | Same; upstream `responseModalities` + `imageConfig`. Output: `image_generation_call` item, `result` is a data URL (`data:image/png;base64,...`), `output_format: null`; events `image_generation_call.in_progress | generating | completed`. Our parser expects bare base64 plus `output_format` | port, small |
| `video_url` part | `{ type: 'input_video', video_url: '<url>' }` (OpenRouter extension). The Chat Completions part shape 400s | remap |
| `modalities: ['audio']` output | 400 on Responses in every shape. Chat Completions streams audio today (`openai/gpt-audio`, `gpt-audio-mini`, two Lyria ids) | loss |
| Image, PDF, audio input | `input_image` data URL, `input_file` (`file_data`, Claude, Gemini, GPT), `input_audio` (Gemini) all work | ok |
| `usage.cost`, `cache_write_tokens` | Same fields under `usage` on the terminal event; no `image_tokens` seen | ok |
| Finish reasons (`end_turn`, `COMPLETE`, `eos`, `network_error`) | Replaced by `status` and `incomplete_details` | ok |
| `delta.images[]` | `image_generation_call` item | port, small |
| Pre-stream error forward | Same shape, see Protocol | ok |
| `: OPENROUTER PROCESSING` comments | Same | ok |
| `stream_options.include_usage` | Not needed | ok |
| Resume and delete handles | Cannot exist (stateless); nothing lost, Chat Completions had none | ok |
| `openrouter.models.ts`, vendor file, image endpoint | Untouched. `/models` has no per-model Responses flag; `supported_parameters` keeps Chat Completions names. Every listed model tested works, including `openrouter/auto`, `openrouter/free`, `:free` ids and `~` aliases | ok |

Also verified: `configuration_update` input item (Fable 5.1), `parallel_tool_calls: false`, `tool_choice: 'none'`, `strict` tools, `text.format` json_schema and json_object (Claude ignores json_object), `reasoning.summary` on GPT (summary parts only when the prompt warrants thinking), `models` fallback array, `service_tier`. Not honored: `reasoning.exclude` (content still returned), `stop` (dropped for Llama, provider 400 on DeepSeek). We send neither.

## Reasoning items

Item: `{ type: 'reasoning', id, status, format, summary[], content[]?, encrypted_content?, signature? }`.

| Vendor | `format` | Carrier | Stream event |
|---|---|---|---|
| OpenAI | `openai-responses-v1` | `encrypted_content` (wrapped: `<blob>.<base64 { endpoint_slug }>`), summary only with `reasoning.summary` | `reasoning_summary_text.delta` |
| xAI | `xai-responses-v1` | `encrypted_content` + summary | `reasoning_summary_text.delta` |
| Anthropic | `anthropic-claude-v1` | `content[].reasoning_text` + `signature` | `reasoning_text.delta` |
| Gemini | `google-gemini-v1` | `content[].reasoning_text`; `encrypted_content` (thought signature) on tool-call turns | `reasoning_text.delta` |
| DeepSeek, Qwen, Kimi, GLM, MiniMax, routers | `unknown` | `content[].reasoning_text` | `reasoning_text.delta` |

- Adaptive-thinking Claude (4.6+, Sonnet 5, Fable) emits no reasoning item on trivial prompts at any effort; that is the model, not the endpoint. A non-trivial prompt reasons at every effort.
- Gemini emits `message` before `reasoning` in `output[]` order.
- Replay: echo items unchanged, whole. Same-model round trips (6 vendors), cross-vendor (9 pairs, e.g. Claude item into GPT history, GPT into Claude) and reasoning-stripped history all complete. `include: ['reasoning.encrypted_content']` is harmless everywhere. `reasoning.context` is GPT-5.6+ only (400 upstream below).

## Port list

- **Dispatch:** `RESPONSES_ONLY_DIALECTS.add('openrouter')`; `enableResumability` forced false; `X-OpenRouter-Metadata: enabled` on the server path only.
- **Adapter** (`_RSP_DIALECT_QUIRKS.openrouter`): `vndNamespace: 'openrouter'`, web search as `openrouter:web_search`, `codeInterpreterTool: false` (offer `openrouter:shell`), `imageGenWebP: false`, `reasoningContextAllTurns: false`, no sources include. Move the Chat Completions reasoning block over with `reasoning.effort` replacing the `verbosity` tunnel; keep `enabled: true` beside every `max_tokens`. Carry `session_id`, `require_parameters`, image modalities + `image_config`, `input_video`, the Fable forced-tool degrade. Cache markers become `prompt_cache_breakpoint` on system-role and user `input_text` blocks with the max-4 trim; the system prompt travels as a system-role message item when a breakpoint is wanted.
- **Parser:** `reasoning_text.delta` and `.done` into reasoning text; capture whole reasoning items (`format`, `signature`, `content`, `encrypted_content`) into `_vnd.openrouter` and echo them whole; accept `openrouter:*` items; data-URL `image_generation_call.result`; provider from `openrouter_metadata`; tolerate Gemini item order.
- **Wiretypes:** `openrouter` in `AixWire_Vendors.RSP_VENDORS`, `AixWire_Parts._vnd` and `DMessageFragmentVendorState`.
- **Unchanged:** `openrouter.models.ts` parameter specs, vendor setup, rate limiter, OAuth, the image-generation router endpoint.

## Verdict

Parity holds for ~30 customizations: 24 one-to-one or remapped, 5 parser ports, 2 losses (audio output on four models; provider label under CSF). Reasoning gets stronger (uniform items, cross-vendor replay, `configuration_update`), caching and search survive with new shapes. The switch is sound once the parser work lands.
