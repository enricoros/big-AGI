# DeepSeek (`deepseek`) over Anthropic Messages

Vendor `deepseek` serves `deepseek-flash` and `deepseek-v4-pro` at `https://api.deepseek.com` on three wires: Chat Completions, Responses, and Anthropic Messages (`POST /anthropic/v1/messages`). big-AGI drives it over Messages on DeepSeek's own host and over Chat Completions on any other host: `chatGenerate.dispatch.ts` (early return in the OpenAI-compatible group), `adapters/deepseek.messageCreate.ts` (prepares and rewrites around `aixToAnthropicMessageCreate('deepseek')`), `parsers/deepseek.messages.parser.ts` (the Anthropic parser with an `AnthropicParserPlugin`, wrapped). Measured on the live API 2026-11-25 unless dated. DeepSeek models on other vendors (OpenRouter, Alibaba, Fireworks, Together, Bedrock, ...) use those vendors' dialects and none of this.

## Wire choice

- `llmsDeepseekWire(protocol, host)` (`llm.isomorphic.ts`) is the one answer, read by the dispatch on every request, the models listing, the setup UI and the model-defs version. A protocol the user set wins; unset (Auto) is Messages for no host or hostname `api.deepseek.com` at any path, Chat Completions for any other host.
- The setting is the service's `deepseekProtocol` (setup: API Protocol), sent as access `dsProtocol`. It is the way back to Chat Completions on the official host, and the opt-in for a proxy that serves Messages.
- The Messages route hangs off the server root: on the native hostname the URL is built from the origin (a `/beta`, `/v1` or `/anthropic` base in the host does not apply), elsewhere it is host + route, minus a trailing `/anthropic`.
- Why Messages (2,715 requests, both models, three wires, then 3,500 more per wire): it is the wire DeepSeek's own client uses (`deepseek-ai/chat-demo`), the only one with search on both models, and half the bytes (182 KB against 460 KB on Chat Completions for the same 1,200-word answer). The three wires are one backend: prompt tokens are identical per request, and the context cache survives a wire switch mid-chat (16/16). Transport failures: 0 in 4,400 on Chat Completions and on Responses, 1 stalled stream in 4,400 on Messages (below).
- Responses was the weakest fit: today's Responses parser fails every DeepSeek response that has thinking (`reasoning_text` content parts), tool loops 400 without `reasoning_text` replayed, and a reasoning item with no text or with `encrypted_content` is a 400.

## Request contract

- Auth: `Authorization: Bearer` or `x-api-key`. `anthropic-version`, `anthropic-beta` and `cache_control` are ignored.
- Client tools are `{name, description, input_schema}` with no `type`: `custom` is a 422 (`unknown variant`). Typed tools are server tools: `web_search_20250305`, `web_search_20260209`, `deepseek_web_search`, `deepseek_read_url`; any other type is a 422.
- Thinking is on by default. `thinking: {type: 'disabled'}` turns it off; `adaptive` reads as enabled and `budget_tokens` is ignored. Effort is `output_config.effort`, `low | high | max` (the vendor's table: minimal is low, medium and xhigh are high). The adapter sends effort alone while on, and `disabled` for effort `none`.
- With thinking on, an assistant turn that has `tool_use` must carry a `thinking` block: 400 otherwise (`The content[].thinking in the thinking mode must be passed back to the API.`), on all three wires in their own shape. Any text passes, the empty one too, and the signature is not checked (another vendor's passed 12/12). The adapter heads each tool turn with its step's reasoning, `''` when there is none, unsigned, and sends no thinking anywhere else: what the Chat Completions wire sends. It does so with thinking off as well, so the history reads the same at every effort.
- A forced call (`tool_choice` `any` or `tool`) is a 400 while thinking is on (`Thinking mode does not support this tool_choice`): the adapter turns thinking off for it.
- `temperature` and `top_p` are read with thinking off only, and are sent only then.
- `max_tokens` is optional and limits each inference step. Unset, the vendor's default applies: 8,192 with thinking off (measured, both wires). The adapter sends the model's value or none, never the Anthropic adapter's default.
- The legacy ids (`deepseek-chat`, `deepseek-reasoner`, `deepseek-v4-flash`, `deepseek-v4-flash-vision-exp`) answer on this wire, with their Chat Completions meaning.
- `deepseek-v4-pro` reads no images on any wire (it answers about an image it did not see): the model keeps `LLM_IF_HOTFIX_StripImages`.

## Stream

- Anthropic's event set. Every complete stream has one `ping`, after the first `content_block_start`, and never two in a row (553 of 553).
- A thinking block ends with a `signature_delta` whose value is a UUID. It signs nothing: it is not stored (`dropThinkingSignatures`), so DeepSeek reasoning is plain text on either wire and is never replayed to Anthropic as a signature. Each thinking block opens its own reasoning fragment (`restart`), which the signature used to do.
- Usage is final in `message_delta`: `input_tokens` excludes cache hits, `cache_read_input_tokens` has them, `output_tokens_details.thinking_tokens` is the reasoning. `cache_creation_input_tokens` is always 0.
- Stop reasons: `end_turn`, `max_tokens`, `tool_use`, `refusal`.

## Web tools

DeepSeek's own server tools (2026-11-13): `deepseek_web_search` and `deepseek_read_url`, declared as `{type, name}` with the same string in both. `deepseek-flash` only: a 400 on `deepseek-v4-pro` on every wire.

- One parameter per tool: `llmVndDeepseekWebSearch`, `llmVndDeepseekReadUrl` (`auto` or unset). The listing gives them to `deepseek-flash` only when the service speaks Messages (`deepseekModelToModelDescription(id, wire)`), so a spec on the model is the whole answer to "can this model search": editors and the Search button read nothing else. A change of wire re-lists (`llmsDefsVersionFor`, and the setup's protocol select).
- Search has two modes, decided by thinking, not by a parameter. Off: one or two rounds of queries, 2 to 4 seconds. On: a deep search over several steps that searches, opens pages (`open_page`) and finds text in them (`find_in_page`): 5 to 32 calls and 17 to 75 seconds measured, billing 20K to 400K input tokens per answer, mostly cache hits.
- `deepseek_read_url` reads the links of the last user message, 10 at most. With thinking on and web search declared it does nothing: the deep search opens the links itself.
- A message with an image is searched by image: `kind` `image_search` or `deep_image_search`, no queries, results with an `image_url`.
- Next to client function tools (2026-11-27, the same on the three wires): a 400 with thinking off (`client tools can only be used together with deepseek_web_search in thinking mode`). With thinking on the request passes and the search is unreliable: it ran in 37 of 72 requests that needed one, and in 0 of 18 where the turn needed the client tool too (the model writes that it will search and the turn ends, or says it has no search tool). The adapter sends the standard search in its place; a forced call takes no search.
- The standard search, `web_search_20250305` (parameter `llmVndAntWebSearch`, listed by `deepseek-v4-pro`): served on this wire to both models, and next to client tools it ran in 80 of 80 requests, thinking on or off. Anthropic's own blocks, read by the Anthropic parser as they are: result lists with snippets, no citations, no page opened. Elsewhere it is `deepseek-v4-pro` only on Responses (where it opens pages) and ignored on Chat Completions (`web_search_options`).
- They cannot share a request with another server tool (400), `tool_choice` cannot name them, and `tool_choice: none` turns them off.
- Free: no per-call fee; the tokens of every inference step are billed, and `usage` is their sum.

On the wire:

- A call is a `server_tool_use` block, complete when it starts (no input deltas), with `kind` (`search`, `deep_search`, `read_link`, `image_search`, `deep_image_search`) and `input.action` (`search` with `queries`, `open_page` with `url`, `find_in_page` with `url` and `pattern`, `read_link` with `url`). Calls made at once come first, then their results, matched by `tool_use_id`.
- Results are Anthropic's blocks with added fields: `web_search_tool_result` (items gain `snippet`, `site_name`, `site_icon`), `web_fetch_tool_result` (`published_at`; `signature` on a link read; the document's `data` is always empty, and its `title` null for a text found in a page). A fetch that fails carries `url_not_accessible`, `url_not_allowed` or `unavailable`. A search that fails is documented as the error inside an array, not seen in 236 captures.
- Shown as `search-web` operations by the plugin's `onServerToolUse` (queries, URL or pattern), closed by the Anthropic result handlers; every page fetched also becomes a citation (AIX-ingestion P8).
- Citations are `citations_delta` of type `web_search_result_location`, with an empty `encrypted_index`; `cited_text` is the answer's own text up to the mark, not the source's. A deep answer can come with none (2 of 24).
- Counts: `usage.server_tool_use.web_search_requests` and `web_fetch_requests` are the result blocks, failed ones included (`nWebSearch`, `nWebFetch`). `tool_search` counts queries and is not read.

Across turns:

- By the vendor's rule only the answer text of earlier rounds is context: their search results, opened pages and thinking are not. Sending text-only history loses nothing there.
- The exception is a link read: echoing its `web_fetch_tool_result` with the `signature` restores the page in later turns (78 KB for an 18K-token page). Echoed, the next turn quotes the page verbatim (18,239 prompt tokens, 18,048 of them cache hits); without it, it cannot (105 tokens). Not stored today: see Deliberately not wired.

## Errors and endings

- HTTP errors are `{type: 'error', error: {type, message}}` here, and `{error: {message, type, param, code}}` on the other two wires. 400 for a contract breach, 401 for the key, 422 for a body that does not deserialize (an unknown tool type or role).
- A generation that fails in the stream sends `event: error` (`api_error`): the Anthropic parser's retry rule applies. Non-streaming, it is an HTTP 200 whose body is `{type: 'error', error, usage}`: the wrapper ends the message with the vendor's words.
- A generation that does not start in time: documented as one `data:` frame with no event name and no `type`, `{"error": {"message"}}`, then the vendor closes. Not seen live. The wrapper ends the message with its words and does not retry.
- A stalled stream: HTTP 200, `message_start`, then a ping about every 15 seconds and no end, for as long as the client stays (1 in about 4,400 requests, held 7 minutes; 0 in a 3,500-request soak). The wrapper ends it at 8 pings in a row, about 2 minutes, with our words, and the executor cancels the body.
- CORS: the preflight reflects the origin and any requested header on every route, so browser-direct (CSF) works on this wire too.

## Deliberately not wired

- The `signature` of a link read: not stored, so a later turn has the answer about a page and not the page. It belongs with the hosted-tool record every vendor lacks (AIX-ingestion P4, P16, P24, P65), not in a DeepSeek-only field.
- DeepSeek's own web tools on `deepseek-v4-pro` (a 400) and next to client tools (unreliable): both get the standard search. When the vendor serves them: the two specs on the model's row in `deepseek.models.ts`, and the swap in the adapter goes.
- A system sentence telling the model it can search: with it the own search ran next to client tools in 79 of 84 requests. Not sent: no prompt of ours in the user's system message.
- The web tools on Chat Completions (custom hosts): the vendor serves them there too (`server_tool_event`, `server_tool_calls`), nothing reads them.
- `latest_reminder` (an extra message role carrying date, weekday, location, platform, language): accepted on Messages and Chat Completions, a 422 on Responses. Without a date in the prompt, deep search anchors on 2025 (2 of 2; 4 of 4 right with a dated system prompt or the marker). The default personas carry the date.
- JSON schema output: ignored on this wire (`output_config.format`), a 400 on Chat Completions, honored on Responses only.
- `title`, `safety_check`, the Files API, the raw Search and Fetch APIs (`/v1/tools/search`, `/v1/tools/fetch`).

Maintenance: `/llms:update-models-deepseek` (catalog, prices, which models take the web tools); captures in `tools/data/aix-replay/generations/deepseek`; the request rules as a test in `adapters/deepseek.messageCreate.test.ts`.
