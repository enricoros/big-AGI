# AIX Ingestion

Rule: AIX translates vendor output into particles and then fragments without transforming it, with minimal loss, ideally none. One fragment per vendor unit (block, part, item), in wire order, the same in streaming and non-streaming: no merging, splitting, reordering, dropping, rewriting or synthesized bytes. Presentation transforms (joining text, grouping reasoning, spacing, hiding, citation lists) happen at render.

Why: signed and encrypted units (Anthropic thinking, Gemini thought signatures, OpenAI encrypted reasoning) are valid only as produced, and a transform at ingestion cannot be undone.

## Conflicts

Open on `main` as of 2026-10-15, from reading the code. Delete an item once fixed. `→` marks an expected effect, not measured.

Paths: `P/` = `src/modules/aix/server/dispatch/chatGenerate/parsers/`, `TX` = `.../chatGenerate/ChatGenerateTransmitter.ts`, `CR` = `src/modules/aix/client/ContentReassembler.ts`. S/NS = streaming/non-streaming.

### Parse: Anthropic (`P/anthropic.parser.ts`)

- [ ] **P1** `\n\n` prefixed to the first text after a `tool_use`/`tool_result` block - `hotFixAntInjectToolsTextSpacer`
- [ ] **P2** Dead leading-`\n\n` elision code - `hotFixAntElideLeadingDoubleNewline`
- [ ] **P3** Only `web_search_result_location` citations forwarded, without `encrypted_index` or owning block; title falls back to the URL → citations cannot be replayed
- [ ] **P4** Server tool blocks become `vp` placeholders: inputs cut to 512 bytes, results URL-only - `_handleCBS_ServerToolUse`, `_handleCBS_*Result` → searches and code re-run; later thinking may be dropped
- [ ] **P5** Client `tool_use.caller` dropped
- [ ] **P6** Unknown block types skipped (thrown in dev); `mcp_tool_use`/`mcp_tool_result` throw
- [ ] **P7** Container files inlined into the open text as `\n\n` + fenced text, images swap `hres` for `ii`, discards become a notice; the file id is lost - `createAnthropicFileInlineTransform`, `createClientAnthropicFileInlineTransform`
- [ ] **P8** `web_fetch_tool_result` synthesizes a citation - `_handleCBS_WebFetchToolResult`
- [ ] **P9** Message `id`, `stop_sequence` dropped; `stop_details` flattened into error text

### Parse: Responses (`P/openai.responses.parser.ts`: OpenAI, xAI, Meta AI, OpenRouter)

- [ ] **P10** S: `\n\n` before `output_text` parts with `content_index > 0` - `OPENAI_RESPONSES_SAME_PART_SPACER`
- [ ] **P11** Summary parts joined with `\n\n` in S, with nothing in NS; NS skips empty summaries - `summaryPartEnter` → S and NS store different text
- [ ] **P12** Code interpreter outputs regrouped (logs joined, images last); synthesized image text, failure text and container expiry - `_forwardDoneCodeInterpreterCallItem`
- [ ] **P13** `refusal` parts dropped
- [ ] **P14** `reasoning_text` dropped
- [ ] **P15** NS: synthetic `**Incomplete response**` text, stored before the reasoning; S sets an issue instead
- [ ] **P16** `web_search_call`, `custom_tool_call`, `image_generation_call` become `vp`/`ii` only; ids, status lost; custom tool input cut to 50 chars → the model may not recognize its own earlier calls
- [ ] **P17** Message and `function_call` item `id`/`status` dropped; unknown `phase` values dropped
- [ ] **P18** Annotation index per part (S wire, NS loop), offsets part-relative; `file_citation`/`file_path` dropped; `container_file_citation` loses offsets - `_forwardTextAnnotation`
- [ ] **P19** xAI: leaked citation directives stripped; S emits held-back text after later annotations, and loses it without `.done` - `XAIDefectiveCitationsFilter`
- [ ] **P20** Reasoning item: an empty `tr_` synthesized as attach target; handle kept only with both `id` and `encrypted_content`
- [ ] **P21** A salvaged `failed` response drops its error text; NS `cancelled`/`in_progress`/`queued` end as `ok`

### Parse: Gemini (`P/gemini.parser.ts`, `P/gemini.interactions.parser.ts`)

- [ ] **P22** Empty text parts collapsed; their signature lands on the previous fragment - `COLLAPSE_EMPTY_TEXT_PARTS`
- [ ] **P23** Consecutive text parts carry no boundary and merge (T1)
- [ ] **P24** `toolCall`/`toolResponse` become `vp`, args cut to 512 chars; signatures land on the previous fragment, also for skipped id-less parts → tool loops lose context
- [ ] **P25** Grounding becomes message-wide citations; `groundingSupports`, `searchEntryPoint`, `citationMetadata`, `retrievalMetadata` dropped; a chunk without `web` fails the parse
- [ ] **P26** Non-media `inlineData` downloaded, bytes not stored
- [ ] **P27** `functionCall` with non-object args dropped, its signature still emitted; `OUTCOME_DEADLINE_EXCEEDED` output moved into error text
- [ ] **P28** Interactions: synthetic markdown in text (`[Image: uri]`, `[Document: uri]`, `[Video: uri]`, status lines)
- [ ] **P29** Interactions: citations disabled - `DISABLE_CITATIONS`
- [ ] **P30** Interactions: thought summary items concatenated into one reasoning run - `_emitThoughtSummary`
- [ ] **P31** Interactions: tool steps become `vp` cut to 80/240 chars in S, skipped in NS; unknown steps, `user_input`, empty text skipped

### Parse: Chat Completions (`P/openai.parser.ts`)

- [ ] **P32** S: leading `<think>` split into reasoning, tags removed, whitespace trimmed; NS keeps it in the text; CR drops the `weak` flag - `appendAutoText_weak`
- [ ] **P33** OpenRouter `reasoning_details` `signature`, `data`, `id`, `format`, `index` stripped by the schema; encrypted reasoning skipped
- [ ] **P34** `annotations`, Perplexity `search_results` become message-wide citations (S dedupes, NS not); a non-`url_citation` annotation kills the stream
- [ ] **P35** NS stores `content` before reasoning; S stores reasoning first
- [ ] **P36** S keeps one of `reasoning_content` > `reasoning_details` > `reasoning`; NS merges the first two into one `ma`
- [ ] **P37** Bug: a delta opening several tool calls keeps only the first (`break` exits the loop); missing ids synthesized, missing names become `unknown_function`
- [ ] **P38** Mistral S: array `text` blocks dropped; NS keeps them
- [ ] **P39** `refusal` never read
- [ ] **P40** Audio `id` dropped, transcript kept as label only; OpenRouter non-`data:` images dropped

### Parse: Bedrock Converse (`P/bedrock-converse.parser.ts`)

- [ ] **P41** `contentBlockIndex` discarded: all text blocks land in one stream
- [ ] **P42** Deltas other than text/`toolUse` and NS blocks other than text/image/`toolUse`/`toolResult` fail the parse; NS assistant images ignored
- [ ] **P43** Stream exception frames dropped; the vendor error never reaches the client

### Parse: all

- [ ] **P44** PCM audio rewrapped as WAV (Gemini, Chat Completions)

### Transmit

- [ ] **T1** `endMessagePart()` emits nothing: unit boundaries never reach the client - `TX`
- [ ] **T2** Missing function-call ids synthesized as `aix_*`, later sent back as vendor ids - `serverSideId`
- [ ] **T3** NS `pause_turn`: content and metrics of every pre-pause segment lost; S loses each segment's final metrics - `_consumeDispatchUnified`
- [ ] **T4** Tool-call args: S keeps vendor bytes, NS re-serializes with `JSON.stringify`

### Reassemble (`CR`)

- [ ] **R1** The text cursor stays open across `vp`, `urlc`, `svs`, `trs`, `trr_`, `aix-info`, retry resets: text on both sides becomes one fragment - `onAppendText` → text blocks no longer match the vendor's; Anthropic may drop later thinking
- [ ] **R2** `trr_` and the `trs` fallback push an `ma` without closing the text cursor: `[text A, redacted, text B]` stores as `[A+B, ma]` (reordered); same for the first annotations fragment
- [ ] **R3** `trr_` appends to the last `ma` even when closed: thinking then redacted become one fragment
- [ ] **R4** `trs` overwrites the signature on the last `ma` with no closed check; creates an empty `ma` when none - `onSetReasoningSignature`
- [ ] **R5** Unsigned reasoning merges into the last unclosed `ma` (Chat Completions, DeepSeek, xAI, Responses items without `encrypted_content`) - `onAppendReasoningText`
- [ ] **R6** Fragment-scoped `svs` attaches to the last fragment of any kind and replaces its vendor namespace - `onSetVendorState` → an earlier Gemini signature can be overwritten
- [ ] **R7** `_fci` args append to the last fragment (no id), discarded when not a call
- [ ] **R8** `urlc` collected into one annotations fragment per message: deduped by URL, ranges merged, first title wins - `onAddUrlCitation`
- [ ] **R9** `vp` placeholders removed when text arrives and at stream end
- [ ] **R10** Generated audio, video, inline downloads stored as text breadcrumbs, bytes not stored
- [ ] **R11** Responses message items without a phase merge into one fragment; a pending phase can land on another item's text
- [ ] **R12** Generated PNGs re-encoded (quality 0.98) unless Labs lossless images is on - `onAppendInlineImage`
- [ ] **R13** A new operation reuses the last transient placeholder even when later fragments follow it (reordered); on non-completed outcomes placeholders are rewritten into errors
- [ ] **R14** One `upstreamContainer` per message, last write wins; handle dropped without `expiresAt`
- [ ] **R15** Opt-in Vertex redirect resolution rewrites URLs in text and citations - `vertexLinksAutoResolveFragments`

### Store

- [ ] **S1** `historyStripThinking` deletes `ma` fragments from all but the newest assistant message, after each turn and on Beam accept; default `chatThinkingPolicy` is `last-only` → older reasoning is lost from the record
- [ ] **S2** NS dispatches end as `done-dispatch-closed`, so placeholders are never swept; rehydrate turns the trailing one into `[ERROR] (message incomplete)` - `inMemHeadCleanDMessage` → replayed as model text (Q1)
- [ ] **S3** Text and tool edits rebuild the fragment without `vendorState`; error edits drop `hint`
- [ ] **S4** The highlighter replaces a fragment with a new `fId`, dropping `originId` and `vendorState` - `useSelHighlighterMemo`
- [ ] **S5** Duplication rebuilds parts from named fields; new part fields are lost - `duplicateDMessageFragments`
- [ ] **S6** Reasoning "inline" converts `ma` to text with a new `fId`, dropping signature, redacted data and `vendorState`

### Replay (`aix.client.chatGenerateRequest.ts`, adapters)

- [ ] **Q1** Assistant error fragments replay as `[ERROR] ...` model text
- [ ] **Q2** Void fragments other than reasoning are skipped, so citations are not replayed (R8)
- [ ] **Q3** Anthropic: a `\n` text block inserted between contiguous thinking blocks - `hotFixAntSeparateContiguousThinkingBlocks`
- [ ] **Q4** Anthropic: one `ma` emits its thinking block, then all its redacted blocks (R3)

## IR gaps

- Text part has no unit identity (R1, R2, R11)
- `ma` holds one signature and no order between `aText` and `redactedData[]` (R3, R4)
- Citations have no owning unit and no vendor object (P3, R8)
- `hosted_resource` has no inlined-content form (P7)
- `tool_invocation` has no vendor fields (P5)
