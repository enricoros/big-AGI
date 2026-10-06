# OpenAI (`openai`) over the Responses dialect

Native OpenAI models carry `LLM_IF_OAI_Responses` and go to `/v1/responses` (`openai.responsesCreate.ts`, `openai.responses.parser.ts`); Chat Completions serves only OpenAI-compatible hosts. Definitions live in `openai.models.ts`, API-validated values in `tools/develop/llm-parameter-sweep/llm-openai-parameters-sweep.json`. Facts below were measured on the live API unless marked as docs.

## Catalog

- GPT-6: Astra (2026-09-03) > Sol > Luna (2026-09-22), plus GPT-6.1 Sol (2026-09-29) between Astra and 6 Sol. GPT-6.1 Astra was pulled before release and has no id. No Terra; `gpt-6` and `gpt-6-terra` 404. GPT-5.6: Sol > Terra > Luna. Tier names carry no rank across generations: Sol was the 5.6 flagship and is the GPT-6 middle tier.
- Ids are stable tier pointers, no dated snapshots. All seven: 1,050,000 context (GPT-6 and 6.1: 922,000 max input), 128,000 output, text and image in.
- Prices: 272K tier on total input (2x input and cache, 1.5x output above it), cache writes 1.25x input, cache reads 10% of input (5% on 6.1 Sol), web search $10/1K calls. See `LLM-pricing-pipeline.md`.

## Request contract

- `reasoning.effort`: Astra and 6.1 Sol low..max; the other Sol, Terra and Luna tiers none..max. `minimal` 400s on GPT-5.6 and GPT-6.
- `temperature`, `top_p`, logprobs: only at effort `none`, so never on Astra or 6.1 Sol. The client lifts `LLM_IF_HOTFIX_NoTemperature` there (`aix.client.ts`).
- `reasoning.mode: 'pro'`: every tier, every effort, every service tier. The answer arrives as one delta; each request adds ~1.4K input tokens of scaffold (~35K with web search).
- `service_tier`: `flex` and `fast` echo as served; `priority` is served as `fast`; `auto` serves `default`. Fast is 2x on every model we expose it for except GPT-5.5 (2.5x); the parser applies that per served model, the parameter's price preview stays at 2x.
- `service_tier: 'ultrafast'` (2026-09-29): GPT-6 Astra on Responses only, 6x on every token class in both context tiers, echoed as `ultrafast` from `response.created`, usage shape unchanged. Every other model, GPT-6.1 Sol down to GPT-5.5 (GPT-5.6 Sol: preview access per docs), and Chat Completions 400 `Invalid service_tier argument`. Streaming and non-streaming both serve it (6 of 6 calls, 2026-10-05). Models opt in through `enumValues` on `llmVndOaiServiceTier` (`gpt-6-astra` and its `::pro` variant); the Chat Completions adapter throws on it; the parser prices 6x only on an `ultrafast` echo.
- Caching is implicit with 24h retention forced: `prompt_cache_retention: 'in_memory'` 400s (AIX never sends it). Cold prompts report `input_tokens_details.cache_write_tokens`, warm ones `cached_tokens`.
- Tools: `web_search`, `code_interpreter`, `image_generation`, functions (auto, required, round trip). Hosted loops stream strictly serial; output items are `reasoning`, `web_search_call`, `code_interpreter_call`, `function_call`, `message` (with `phase`).

## Reasoning continuity

- Capture: the parser stores `{ id, encryptedContent }` as `_vnd.openai.reasoningItem` on the `ma` fragment, only when both are present; `phase` rides on text fragments.
- Replay: the adapter sends reasoning items as `{ id, summary: [], encrypted_content }`, assistant messages with `phase`, function calls and outputs, and code interpreter calls (live container id, else an `execute_code` function call). `web_search_call` items are not replayed; GPT-5.6 and GPT-6 accept reasoning items without their following search item and answer coherently.
- `reasoning.context`: `auto` | `current_turn` | `all_turns`. The default is `current_turn` up to 5.5 and `all_turns` on 5.6 and GPT-6. The adapter sends `all_turns` on gpt-5.4+, except at effort `none` and on Azure.
- Family rule (docs: guides/reasoning, "Preserve reasoning across calls"): items render only within a model family. GPT-6 Astra, Sol, Luna and 6.1 Sol read each other's items (6.1 Sol measured both ways with Astra and 6 Sol); so do the GPT-5.6 tiers; 5.6 to 6 or 6.1, 6 to 5.6 and 6 to 5.5 do not. No parameter overrides it.
- The omission is silent: no error, no warning, no header, and the echoed `reasoning.context` still says `all_turns`. The only trace is `usage.input_tokens`: omitted items are not billed, so the count equals the reasoning-stripped history. The same holds through OpenRouter's Responses endpoint.
- Consequence: after a family switch the model sees only the visible transcript. Facts that lived only in reasoning are gone, and the model may invent them (5.6 Sol produced a made-up code instead of saying it had none). This applies to model switches mid-chat and to mixed-family Beam rays. AIX has no family gate; the send-side lever is the chat 'Reasoning traces' policy.
- Every OpenAI-compatible Responses service (native, Azure, Bedrock Mantle) shares the `openai` namespace, so a handle from one is replayed to another. Cross-organization and cross-provider replay is untested.

## Chat Completions

The native definitions route GPT-5.x, GPT-6 and 6.1 over Responses. On Chat Completions (compatible hosts): effort up to xhigh (`max` 400s), from `low` on Astra and 6.1 Sol and from `none` elsewhere; function tools 400 unless effort is `none` on 6 Sol and Luna, and at every effort on Astra and 6.1 Sol ("Function tools with reasoning_effort are not supported ... use /v1/responses"). On the native and Azure dialects the adapter strips `temperature`/`top_p` from gpt-5/6 and o-family ids.

## OpenRouter

- `openai/gpt-6-sol`, `-sol-pro`, `-luna`, `-luna-pro`, `openai/gpt-6.1-sol` and `-pro` (plus `:batch`). A `-pro` id is the base model in pro mode; `llmOrtOaiLookup` maps it to the base definition with the mode pinned.
- Chat Completions on OpenRouter accepts every effort (including `minimal`) and `temperature` at any effort, normalizing upstream. Effort is honored (`max` spent 8x the reasoning tokens of `low` on Sol), `reasoning.mode: 'pro'` reroutes to the `-pro` id, and function tools work together with reasoning.
- `service_tier` routes to the `openai/flex` and `openai/fast` endpoints on every model that exposes `llmVndOaiServiceTier` natively (GPT-5.4 through GPT-6): `flex` bills 0.5x, `fast` and `priority` 2x (2.5x on GPT-5.5), echoed as `priority`. Wired through `_ORT_OAI_PARAM_ALLOWLIST`; the reported `cost` carries the tier. `service_tier: 'ultrafast'` measured as served `priority` at 2x (Astra and 6.1 Sol, both dialects), so `llmOrtOaiLookup` strips `ultrafast` from the tier list. Astra now lists an `openai/ultrafast` endpoint at 6x; whether `service_tier` reaches it is unmeasured - re-probe before un-stripping.
- Auto picks match the exact `llmRef` first: OpenRouter lists `-pro` ids before the base on same-day releases.

## Bedrock

- Mantle lists `openai.gpt-6-sol` and `-luna` in us-east-1 and `openai.gpt-6-astra` in us-west-2. AWS also lists GPT-5.6 and GPT-6 as bedrock-runtime foundation models with `us.`/`global.` profiles.
- Bare ids that Mantle serves take the curated Mantle Responses route (`KNOWN_MANTLE_ONLY`). Profiles and ids Mantle does not list still describe as 131K Chat Completions or Converse models without reasoning: per the AWS card Mantle serves no geo or global ids, and bedrock-runtime `/openai/v1` is not wired.
- Our key gets 401 `access_denied` on every OpenAI id, so these routes are not live-verified here.

## Shipped, not adopted

Async tool calling (`async: true` on tools; the model answers before the result and may emit two message items), `configuration_update` input items (change effort mid-conversation, cache prefix intact), `prompt_cache_options.ttl: '30m'`, the `{ type: 'computer' }` tool (batched `actions[]`), `shell` and `apply_patch`, programmatic tool calling, image detail `original`, WebSocket mode (docs recommend it for Ultrafast in tool-heavy loops; AIX streams over HTTP SSE), Multi-agent (next section). Not probed: mid-turn steering over WebSockets, misalignment monitoring (can stop a conversation for review).

## Multi-agent

Beta (2026-09-29), not adopted.

- Request: `multi_agent: { enabled, max_concurrent_subagents }` (default 3) plus header `OpenAI-Beta: responses_multi_agent=v1`, which 400s when missing. Docs list GPT-6.1 Sol and GPT-5.6; GPT-6 Astra, Sol and Luna also accept it and spawn subagents. It 400s with `reasoning.summary`, which the adapter sends at every effort above `none`; docs add `max_tool_calls` and `/responses/compact`, and implicit server-side compaction per agent.
- Stream: three item types. `multi_agent_call` records a hosted action (`spawn_agent`, `send_message`, `followup_task`, `wait_agent`, `interrupt_agent`, `list_agents`), `multi_agent_call_output` its result, `agent_message` an encrypted message with `author` and `recipient`. Items and item-level events carry `agent.agent_name` (`/root`, `/root/<task>`). Items from different agents are open at the same time: subagent `message` items (phase `final_answer`) interleave their deltas with the root's.
- Usage: one aggregate `usage`, no per-agent split. The scaffold adds about 1.1K input tokens per request; a trivial two-subagent task billed 3.6K input.
- Replay: the full output replays with `store: false`, and the root recalls subagent names and results. Replaying multi-agent items without `multi_agent.enabled` 400s ("must remain enabled when continuing"), so one use locks the conversation in. Stripping history to root messages works, but the model then denies having used subagents.
- Adoption path: a per-model toggle on native OpenAI; the adapter adds the header and `multi_agent` and drops `reasoning.summary`; wiretypes add the three items and optional `agent`; the parser routes by `agent.agent_name` (root text and reasoning to the message, subagent text to a collapsed trace, hosted actions as placeholders) and allows concurrent open items; non-root items are stored opaquely on the message and replayed only while the toggle is on, otherwise stripped to root.

## Sign in with ChatGPT

Not adopted. Docs as of 2026-09-29; CORS measured.

- ChatGPT plan usage for open-source and locally hosted apps: PKCE OAuth with dynamic registration (`client_id=dynamic_agent_client` on first sign-in, the issued `oaiapp_...` id afterwards), a persisted `ext_agent_host_id` per host, no client secret, no partner key. Paid or remotely hosted apps go through OpenAI's interest form.
- The redirect must be `http://127.0.0.1:<port>/auth/callback`; only the port may vary, `localhost` is rejected. A hosted instance cannot receive it.
- Tokens: 1h access token, used as the bearer on `api.openai.com/v1/responses`; 30-day rotating refresh token. Docs require keeping tokens out of browser storage. The `auth.openai.com` token endpoint and `/v1/responses` both answer CORS preflight with `*`.
- Request contract: `store: false` and `stream: true` required. Rejected: `max_output_tokens`, `temperature`, `top_p`, `prompt_cache_retention`, `truncation`, `metadata`, `user`, `multi_agent`, `role: 'system'` message items, and the image generation, code interpreter, file search, computer use and hosted MCP tools. Function tools go in namespaces. `/v1/models` returns `models[]` with `slug`, `display_name`, `visibility` instead of `data[]`.
- Errors: admission failures return `{"detail": ...}` before the stream; plan errors use `subscription_sharing_*` codes, and a usage-limit error can arrive mid-stream as `response.failed`. Plus plans share one 5-hour limit across all apps.

## Parser risks

- Output items and stream events are closed unions: an unknown item type fails the stream. None seen on GPT-6 without opt-in features. Multi-agent items would fail it at the first spawn (zod rejects `multi_agent_call`, checked against a captured stream); AIX sends neither `multi_agent` nor its beta header.
- Two reasoning items with nothing in between would merge into one `ma` fragment and keep only the second handle. Not observed: in 12 multi-step GPT-6 runs, tool calls or messages always separated them.
