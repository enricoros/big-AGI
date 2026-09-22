# OpenAI (`openai`) over the Responses dialect

Native OpenAI models carry `LLM_IF_OAI_Responses` and go to `/v1/responses` (`openai.responsesCreate.ts`, `openai.responses.parser.ts`); Chat Completions serves only OpenAI-compatible hosts. Definitions live in `openai.models.ts`, API-validated values in `tools/develop/llm-parameter-sweep/llm-openai-parameters-sweep.json`. Facts below were measured on the live API unless marked as docs.

## Catalog

- GPT-6: Astra (2026-09-03) > Sol > Luna (2026-09-22). No Terra; `gpt-6` and `gpt-6-terra` 404. GPT-5.6: Sol > Terra > Luna. Tier names carry no rank across generations: Sol was the 5.6 flagship and is the GPT-6 middle tier.
- Ids are stable tier pointers, no dated snapshots. All six: 1,050,000 context (GPT-6: 922,000 max input), 128,000 output, text and image in.
- Prices: 272K tier on total input (2x input and cache, 1.5x output above it), cache writes 1.25x input, web search $10/1K calls. See `LLM-pricing-pipeline.md`.

## Request contract

- `reasoning.effort`: Astra low..max; Sol and Luna none..max. `minimal` 400s on GPT-5.6 and GPT-6.
- `temperature`, `top_p`, logprobs: only at effort `none`. The client lifts `LLM_IF_HOTFIX_NoTemperature` there (`aix.client.ts`).
- `reasoning.mode: 'pro'`: every tier, every effort, every service tier. The answer arrives as one delta; each request adds ~1.4K input tokens of scaffold (~35K with web search).
- `service_tier`: `flex` and `fast` echo as served; `priority` is served as `fast`; `auto` serves `default`. Fast is 2x on every model we expose it for except GPT-5.5 (2.5x); the parser applies that per served model, the parameter's price preview stays at 2x.
- Caching is implicit with 24h retention forced: `prompt_cache_retention: 'in_memory'` 400s (AIX never sends it). Cold prompts report `input_tokens_details.cache_write_tokens`, warm ones `cached_tokens`.
- Tools: `web_search`, `code_interpreter`, `image_generation`, functions (auto, required, round trip). Hosted loops stream strictly serial; output items are `reasoning`, `web_search_call`, `code_interpreter_call`, `function_call`, `message` (with `phase`).

## Reasoning continuity

- Capture: the parser stores `{ id, encryptedContent }` as `_vnd.openai.reasoningItem` on the `ma` fragment, only when both are present; `phase` rides on text fragments.
- Replay: the adapter sends reasoning items as `{ id, summary: [], encrypted_content }`, assistant messages with `phase`, function calls and outputs, and code interpreter calls (live container id, else an `execute_code` function call). `web_search_call` items are not replayed; GPT-5.6 and GPT-6 accept reasoning items without their following search item and answer coherently.
- `reasoning.context`: `auto` | `current_turn` | `all_turns`. The default is `current_turn` up to 5.5 and `all_turns` on 5.6 and GPT-6. The adapter sends `all_turns` on gpt-5.4+, except at effort `none` and on Azure.
- Family rule (docs: guides/reasoning, "Preserve reasoning across calls"): items render only within a model family. GPT-6 Astra, Sol and Luna read each other's items; so do the GPT-5.6 tiers; 5.6 to 6, 6 to 5.6 and 6 to 5.5 do not. No parameter overrides it.
- The omission is silent: no error, no warning, no header, and the echoed `reasoning.context` still says `all_turns`. The only trace is `usage.input_tokens`: omitted items are not billed, so the count equals the reasoning-stripped history. The same holds through OpenRouter's Responses endpoint.
- Consequence: after a family switch the model sees only the visible transcript. Facts that lived only in reasoning are gone, and the model may invent them (5.6 Sol produced a made-up code instead of saying it had none). This applies to model switches mid-chat and to mixed-family Beam rays. AIX has no family gate; the send-side lever is the chat 'Reasoning traces' policy.
- Every OpenAI-compatible Responses service (native, Azure, Bedrock Mantle) shares the `openai` namespace, so a handle from one is replayed to another. Cross-organization and cross-provider replay is untested.

## Chat Completions

The native definitions route GPT-5.x and GPT-6 over Responses. On Chat Completions (compatible hosts): effort none..xhigh (`max` 400s); function tools 400 unless effort is `none` on Sol and Luna, and at every effort on Astra ("Function tools with reasoning_effort are not supported ... use /v1/responses"). On the native and Azure dialects the adapter strips `temperature`/`top_p` from gpt-5/6 and o-family ids.

## OpenRouter

- `openai/gpt-6-sol`, `-sol-pro`, `-luna`, `-luna-pro`. A `-pro` id is the base model in pro mode; `llmOrtOaiLookup` maps it to the base definition with the mode pinned.
- Chat Completions on OpenRouter accepts every effort (including `minimal`) and `temperature` at any effort, normalizing upstream. Effort is honored (`max` spent 8x the reasoning tokens of `low` on Sol), `reasoning.mode: 'pro'` reroutes to the `-pro` id, and function tools work together with reasoning.
- `service_tier` routes to the `openai/flex` and `openai/fast` endpoints on every model that exposes `llmVndOaiServiceTier` natively (GPT-5.4 through GPT-6): `flex` bills 0.5x, `fast` and `priority` 2x (2.5x on GPT-5.5), echoed as `priority`. Wired through `_ORT_OAI_PARAM_ALLOWLIST`; the reported `cost` carries the tier.
- Auto picks match the exact `llmRef` first: OpenRouter lists `-pro` ids before the base on same-day releases.

## Bedrock

- Mantle lists `openai.gpt-6-sol` and `-luna` in us-east-1 and `openai.gpt-6-astra` in us-west-2. AWS also lists GPT-5.6 and GPT-6 as bedrock-runtime foundation models with `us.`/`global.` profiles.
- Bare ids that Mantle serves take the curated Mantle Responses route (`KNOWN_MANTLE_ONLY`). Profiles and ids Mantle does not list still describe as 131K Chat Completions or Converse models without reasoning: per the AWS card Mantle serves no geo or global ids, and bedrock-runtime `/openai/v1` is not wired.
- Our key gets 401 `access_denied` on every OpenAI id, so these routes are not live-verified here.

## Shipped, not adopted

Async tool calling (`async: true` on tools; the model answers before the result and may emit two message items), `configuration_update` input items (change effort mid-conversation, cache prefix intact), `prompt_cache_options.ttl: '30m'`, the `{ type: 'computer' }` tool (batched `actions[]`), `shell` and `apply_patch`, programmatic tool calling, image detail `original`. Not probed: mid-turn steering over WebSockets, misalignment monitoring (can stop a conversation for review).

## Parser risks

- Output items and stream events are closed unions: an unknown item type fails the stream. None seen on GPT-6 so far.
- Two reasoning items with nothing in between would merge into one `ma` fragment and keep only the second handle. Not observed: in 12 multi-step GPT-6 runs, tool calls or messages always separated them.
