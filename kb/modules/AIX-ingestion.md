# AIX Ingestion

Rule: AIX translates vendor output into particles and then fragments without transforming it, with minimal loss, ideally none. One fragment per vendor unit (block, part, item), in wire order, the same in streaming and non-streaming: no merging, splitting, reordering, dropping, rewriting or synthesized bytes. Presentation transforms (joining text, grouping reasoning, spacing, hiding, citation lists) happen at render.

Why: signed and encrypted units (Anthropic thinking, Gemini thought signatures, OpenAI encrypted reasoning) are valid only as produced, and a transform at ingestion cannot be undone.

## Conflicts

Open on `main` as of 2026-10-15, verified by code reading and a live probe through the AIX Protocol Lab (416 generation requests, 2026-10-15). Delete an item once fixed; new items take the next free number in their letter.

Priority: `urgent` measured user-visible damage or hard failure on a common path; `high` the same on a common feature, or a hard failure on an edge path; `medium` record loss with minor effect, or an edge path; `low` synthetic only, no effect, or dead code. `(client tools)`: reachable only where the app sends client tools (main's chat sends none; auto follow-ups and the capability probes do). `→` marks an expected effect, not measured.

Paths: `P/` = `src/modules/aix/server/dispatch/chatGenerate/parsers/`, `TX` = `.../chatGenerate/ChatGenerateTransmitter.ts`, `CR` = `src/modules/aix/client/ContentReassembler.ts`. S/NS = streaming/non-streaming.

### Parse: Anthropic (`P/anthropic.parser.ts`)

- [ ] **P4** (urgent) Server tool blocks become `vp` placeholders, inputs cut to 512 bytes, results URL-only - `_handleCBS_ServerToolUse`, `_handleCBS_*Result`. The next turn re-runs the tools (8/8 chains), calls its earlier results fabricated, and drops the thinking after them
- [ ] **P3** (high) Only `web_search_result_location` citations forwarded; `char_location` (fetched documents) dropped; `encrypted_index` and owning block lost; title falls back to the URL. Replay without citations drops later thinking when isolated from P4
- [ ] **P7** (high) Container files inlined into the open text as `\n\n` + fenced text, images swap `hres` for `ii`, discards become a notice; file ids lost; the CSV replays as model-authored text - `createAnthropicFileInlineTransform`, `createClientAnthropicFileInlineTransform`
- [ ] **P1** (low) `\n\n` prefixed to text after a hosted or tool block, also across an intervening thinking block - `hotFixAntInjectToolsTextSpacer`. Binding-neutral
- [ ] **P2** (low) Dead leading-`\n\n` elision code - `hotFixAntElideLeadingDoubleNewline`
- [ ] **P5** (low, client tools) Client `tool_use.caller` dropped; replay accepted
- [ ] **P6** (low) Unknown block types skipped in production, fatal to the stream in development builds and strict mode; `mcp_tool_use`/`mcp_tool_result` throw (MCP is never sent)
- [ ] **P8** (low) `web_fetch_tool_result` synthesizes a citation, the only fetch source left in the record - `_handleCBS_WebFetchToolResult`. Not replayed
- [ ] **P9** (low) Message `id`, `stop_sequence` dropped; `stop_details` flattened into error text, replayed as `[ERROR]` (Q1)

### Parse: Responses (`P/openai.responses.parser.ts`: OpenAI, xAI, Meta AI, Sakana)

- [ ] **P16** (urgent) `web_search_call`, `custom_tool_call`, `image_generation_call` become `vp`/`ii` only; ids, status lost; custom tool input cut to 50 chars. The next turn denies its own searches (OpenAI 2/2) and loses the image-generation turn
- [ ] **P48** (high) xAI: hosted search results arrive as encrypted `tco_` reasoning items and are stored as reasoning; the thinking strip (S1) removes them, and the model then invents earlier results (4/5)
- [ ] **P19** (medium) xAI: leaked citation directives stripped by a grammar that misses the live form (`render_inline_citation visamp...`, shown verbatim on grok-4.6); S holds back tail text, lost without `.done`, which xAI omits on truncation - `XAIDefectiveCitationsFilter`
- [ ] **P51** (medium) S `response.incomplete` never sets the dialect end: a trailing hosted-op placeholder survives and becomes `[ERROR] (message incomplete)` on reload (S2)
- [ ] **P50** (medium) Sakana: Gemini-backed turns end with an empty message holding the annotation; S drops it, NS stores an empty text fragment and an unswept placeholder (S2)
- [ ] **P12** (medium) Code interpreter outputs regrouped (logs joined, images last); synthesized image text, failure text and container expiry replay as vendor logs - `_forwardDoneCodeInterpreterCallItem`
- [ ] **P15** (medium) NS: synthetic `**Incomplete response**` text stored before the reasoning and replayed as assistant text; S sets an issue instead
- [ ] **P18** (medium) Annotation offsets part-relative and unlinked from their fragment (wrong span in the joined text 16/23); `file_citation`/`file_path` dropped; `container_file_citation` loses offsets - `_forwardTextAnnotation`
- [ ] **P17** (low) Message and `function_call` item `id`/`status` dropped; unknown `phase` values dropped. Replay accepted, no measured effect
- [ ] **P49** (low) xAI: a message item kept open across later search and reasoning items is stored as two text fragments and replayed as two assistant messages
- [ ] **P11** (low) Summary parts joined with `\n\n` in S, with nothing in NS; NS skips empty summaries - `summaryPartEnter`. Summaries are not replayed
- [ ] **P20** (low) Reasoning item: an empty `tr_` synthesized as attach target (one `ma` per item); handle kept only with both `id` and `encrypted_content`, always present when streamed
- [ ] **P10** (low) S: `\n\n` before `output_text` parts with `content_index > 0` - `OPENAI_RESPONSES_SAME_PART_SPACER`. Not reproduced live (0/97 multi-part messages)
- [ ] **P21** (low) A salvaged `failed` response drops its error text; NS `cancelled`/`in_progress`/`queued` end as `ok` (synthetic)
- [ ] **P13** (low) `refusal` parts dropped; a refusal-only message stores nothing (synthetic)
- [ ] **P14** (low) `reasoning_text` dropped; never emitted by GPT-6 (0/87 items)

### Parse: Gemini (`P/gemini.parser.ts`, `P/gemini.interactions.parser.ts`)

- [ ] **P24** (urgent) `toolCall`/`toolResponse` (hosted search, URL context) become `vp`, args cut to 512 chars, never stored (70/70 signed parts lost); their signatures land on the previous fragment. The next turn re-searches or cites URLs absent from the wire
- [ ] **P44** (medium) Audio rewrapped as WAV: Gemini TTS already returns WAV, so the inner header and C2PA chunk become samples (audible click, provenance lost); Chat Completions PCM16 wrap is lossless
- [ ] **P26** (medium) Non-media `inlineData` downloaded, bytes not stored; the breadcrumb replays as model text
- [ ] **P25** (medium) Grounding becomes message-wide citations; `groundingSupports`, `searchEntryPoint`, `citationMetadata`, `retrievalMetadata` dropped; a chunk without `web` fails the parse
- [ ] **P31** (medium) Interactions: tool steps become `vp` cut to 80/240 chars in S, skipped in NS; the follow-up re-ran both searches when told not to; unknown steps, `user_input`, empty text skipped
- [ ] **P52** (medium) Interactions: the NS (Recover) parser ignores `environment_id`, so the next turn gets a fresh sandbox
- [ ] **P22** (low) Empty text parts collapsed; their signature moves to the preceding text - `COLLAPSE_EMPTY_TEXT_PARTS`. Accepted on replay (21/21)
- [ ] **P30** (low) Interactions: thought summary items concatenated into one reasoning run - `_emitThoughtSummary`
- [ ] **P27** (low) A `functionCall` with non-object args dropped while its signature is still emitted, next turn 400 (synthetic); `OUTCOME_DEADLINE_EXCEEDED` output moved into error text
- [ ] **P28** (low) Interactions: synthetic markdown in text (`[Image: uri]`, `[Document: uri]`, `[Video: uri]`, status lines) (synthetic)
- [ ] **P29** (low) Interactions: citations disabled - `DISABLE_CITATIONS`
- [ ] **P23** (low) Consecutive text parts carry no boundary and merge (T1). Not reproduced (0/12 2.5 URL-context runs, 0/21 3.x NS)

### Parse: Chat Completions (`P/openai.parser.ts`)

- [ ] **P37** (urgent, client tools) A delta opening several tool calls keeps only the first (`break` exits the loop): Mistral direct and Cerebras qwen lose 22/31 calls; missing names become `unknown_function`
- [ ] **P45** (urgent, client tools) Empty `content`/`reasoning_content` deltas become empty `t`/`tr_` particles between a call and its argument chunks: arguments lost (R7) on Alibaba, Together, Baseten and Fireworks GLM; empty fragments stored elsewhere
- [ ] **P46** (urgent, client tools) A trailing `content:""` after tool calls stores an empty text fragment; replay splits the calls from their results: 400 on DeepSeek and OpenRouter -> Anthropic
- [ ] **P38** (high) Mistral S: the delta switching from thinking to answer carries `[thinking, text]` and its text is dropped (5/8 answers lose their opening); NS keeps it
- [ ] **P33** (high) OpenRouter `reasoning_details` `signature`, `data`, `id`, `format`, `index` stripped by the schema; encrypted reasoning skipped; none replayed, so every turn re-reasons
- [ ] **P47** (medium, client tools) `tool_calls[].id: null` fails the chunk schema and kills the stream (Arcee, qwen3.8-max)
- [ ] **P32** (medium) S splits only a leading `<think>` on the first chunk (an empty or newline first chunk, or a split tag, defeats it); MiniMax S stores both the tag content and `delta.reasoning`; NS keeps `<think>` in the text
- [ ] **P34** (medium) `annotations`, Perplexity `search_results` become message-wide citations (`snippet`, `last_updated`, `source` dropped; S stores them before the text, NS after); a non-`url_citation` or untitled annotation fails the parse
- [ ] **P35** (low) NS stores `content` before reasoning; S stores reasoning first
- [ ] **P36** (low) NS merges `reasoning_content` and `reasoning_details` into one `ma` (synthetic; no live provider sends both)
- [ ] **P39** (low) `refusal` never read (synthetic)
- [ ] **P40** (low) Audio `id` dropped, transcript kept only as the label; OpenRouter non-`data:` images dropped (synthetic)

### Parse: Bedrock (`P/bedrock-converse.parser.ts`, Anthropic-on-Bedrock)

- [ ] **P42** (high) Converse deltas other than text/`toolUse`, and NS blocks other than text/image/`toolUse`/`toolResult`, fail the parse: reasoning models (gpt-oss, DeepSeek R1, Kimi K2) return no answer (4/4); NS assistant images ignored
- [ ] **P41** (low) `contentBlockIndex` discarded: adjacent text blocks land in one stream (synthetic)
- [ ] **P43** (low) Converse stream exception frames skipped as unknown events; the vendor message is lost behind a generic truncation error (synthetic)
- [ ] **P53** (low) Anthropic-on-Bedrock: an exception frame crashes the Anthropic parser's error handler; the vendor text survives only inside the issue's input data (synthetic)

### Transmit

- [ ] **T3** (high) NS `pause_turn`: content and metrics of every pre-pause segment lost (44 blocks, 10 searches on one turn) - `_consumeDispatchUnified`. S totals are correct
- [ ] **T1** (high) `endMessagePart()` emits nothing: unit boundaries never reach the client (168 Anthropic text blocks stored as 47 fragments) - `TX`
- [ ] **T2** (low) S synthesizes missing function-call ids as `aix_*` (Gemini 2.5), accepted on replay; NS does not synthesize, a missing NS id fails the parse - `serverSideId`
- [ ] **T4** (low) NS re-serializes tool-call args with `JSON.stringify` on Anthropic, Bedrock, Gemini; no replay effect. Chat Completions NS keeps vendor bytes
- [ ] **T5** (low) Argument chunks for an earlier call arriving after a later call opened throw `arguments id mismatch` and kill the stream (synthetic)

### Reassemble (`CR`)

- [ ] **R7** (urgent, client tools) `_fci` args append to the last fragment (no id); when it is not the call, each chunk becomes an error fragment and the call keeps `""` args (P45) - `onAppendFunctionCallInvocationArgs`
- [ ] **R1** (high) The text cursor stays open across `vp`, `urlc`, `svs`, `trs`, `trr_`, `aix-info`, retry resets, and boundaries never arrive (T1): text on both sides becomes one fragment - `onAppendText`. A merge drops later Anthropic thinking when isolated from P4
- [ ] **R8** (high) `urlc` collected into one annotations fragment per message: on Anthropic (no offsets) a repeat URL is dropped whole; elsewhere ranges merge; first title wins - `onAddUrlCitation`
- [ ] **R16** (high) `createDVoidWebCitation` (`chat.fragments.ts`) drops `textSnippet` without offsets: every Anthropic `cited_text` is lost
- [ ] **R9** (medium) `vp` placeholders removed when text arrives and at stream end: the op log (queries, URLs, code, output) is lost
- [ ] **R10** (medium) Generated audio, video, inline downloads stored as text breadcrumbs, bytes not stored; the breadcrumb replays as model text
- [ ] **R13** (medium) A new operation reuses the last transient placeholder even when later fragments follow it, stored out of order on abort; on non-completed outcomes placeholders are rewritten into errors - `onSetOperationState`
- [ ] **R6** (medium) Fragment-scoped `svs` attaches to the last fragment of any kind and replaces its vendor namespace: Gemini hosted-tool signatures overwrite each other on placeholders (44/144), never on text or calls - `onSetVendorState`
- [ ] **R2** (low) `trr_` and the `trs` fallback push an `ma` without closing the text cursor: `[text A, redacted, text B]` stores as `[A+B, ma]` (synthetic)
- [ ] **R3** (low) `trr_` appends to the last `ma` even when closed: thinking and redacted blocks become one fragment; replay keeps wire order
- [ ] **R4** (low) `trs` overwrites the signature on the last `ma` with no closed check; creates an empty `ma` when none - `onSetReasoningSignature` (synthetic)
- [ ] **R5** (low) Unsigned reasoning merges into the last unclosed `ma`: Responses items without `encrypted_content` (synthetic); live xAI and OpenAI items always carry a handle - `onAppendReasoningText`
- [ ] **R11** (low) Responses message items without a phase merge into one fragment; a pending phase can land on another item's text (synthetic; GPT-6 tags every item)
- [ ] **R12** (low) Generated PNGs re-encoded to WebP or JPEG at q0.98 unless Labs lossless images is on: hits code-execution charts (Gemini image models return JPEG) - `onAppendInlineImage`
- [ ] **R14** (low) One `upstreamContainer` per message, last write wins; handle dropped without `expiresAt` (synthetic)
- [ ] **R15** (low) Opt-in Vertex redirect resolution rewrites URLs in text and citations - `vertexLinksAutoResolveFragments`
- [ ] **R17** (low) A generated-media breadcrumb inherits the media part's Gemini signature, replayed on synthesized text

### Store

- [ ] **S2** (high) A transient placeholder left last (Stop during a hosted op; P51; NS turns, never swept) becomes `[ERROR] (message incomplete)` on rehydrate - `inMemHeadCleanDMessage`; replayed (Q1), the model redoes its work
- [ ] **S3** (high) Text and tool edits rebuild the fragment without `vendorState`: Gemini text signature lost (accepted), Gemini function call 400 (client tools), Responses `phase` lost; error edits drop `hint`
- [ ] **S4** (high) The highlighter replaces a fragment with a new `fId`, dropping `originId` and `vendorState` (one click; same effects as S3) - `useSelHighlighterMemo`
- [ ] **S1** (high) `historyStripThinking` deletes `ma` fragments from all but the newest assistant message, after each turn and on Beam accept (default `chatThinkingPolicy` `last-only`): deletes xAI search results (P48); elsewhere no 400 and minor token changes
- [ ] **S6** (medium) Reasoning "inline" converts `ma` to text with a new `fId`, dropping signature, redacted data and `vendorState`; replayed as assistant text
- [ ] **S5** (low) Duplication rebuilds parts from named fields; no field lost today, a new optional part field would be (the exhaustive check covers `pt` only) - `duplicateDMessageFragments`

### Replay (`aix.client.chatGenerateRequest.ts`, adapters)

- [ ] **Q1** (high) Assistant error fragments replay as `[ERROR] ...` model text, parse issues with up to 2,048 chars of raw response JSON; the model reads them as its own output
- [ ] **Q2** (high) Void fragments other than reasoning are skipped, so citations are not replayed (R8); replay without citations drops later Anthropic thinking when isolated from P4
- [ ] **Q5** (high) Anthropic: model image parts are moved first and sent as user content (`hotFixImagePartsFirst`, `hotFixMapModelImagesToUser`): a generated chart lands in the user's message and that turn's thinking is dropped
- [ ] **Q6** (high) OpenAI: assistant images sent as a user `input_image`: an image-generation turn dissolves into the user message, a code chart splits the assistant turn
- [ ] **Q7** (medium) Gemini: a hosted `codeExecutionResult` replayed under role `user`, splitting the model turn (accepted)
- [ ] **Q9** (medium, client tools) DeepSeek: every `ma` concatenated onto the last tool-call message, `''` sent on earlier ones; accepted, prefix-cache hits lost each iteration
- [ ] **Q3** (low) Anthropic: a `\n` text block inserted between contiguous thinking blocks - `hotFixAntSeparateContiguousThinkingBlocks`. Binding-neutral; 5.x models accept contiguous thinking; most insertions sit where P4 removed hosted blocks
- [ ] **Q4** (low) Anthropic: one `ma` emits its thinking block, then all its redacted blocks (R3); matches wire order for every stored shape
- [ ] **Q8** (low) OpenAI: `attachCodeInterpreterCallOutputs` overwrites `outputs` per stored tool result, only the last replays (synthetic)
- [ ] **Q10** (low) Gemini: an assistant turn holding only `ma` fragments emits no model content, leaving two user contents adjacent (synthetic)

## IR gaps

- Text part has no unit identity (R1, R2, R11)
- `ma` holds one signature and no order between `aText` and `redactedData[]` (R3, R4)
- Citations have no owning unit and no vendor object (P3, R8, R16)
- Hosted tool blocks and items have no stored form (P4, P16, P24); xAI search results survive only as reasoning (P48)
- `hosted_resource` has no inlined-content form (P7)
- `tool_invocation` has no vendor fields (P5)
