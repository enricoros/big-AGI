import * as z from 'zod/v4';


/**
 * Gemini Interactions API wiretypes (Beta)
 *
 * 2026-04-21: NOTE - MINIMAL IMPL for DEEP RESEARCH AGENT
 * Scope: only what the Deep Research agents need.
 *  - Single-turn by default (we don't yet send `previous_interaction_id` for multi-turn state reuse)
 *  - `store: true` is sent (spec says optional; DR guide recommends it for background runs).
 *    We best-effort DELETE on completion/abort to minimize server-side retention.
 *  - `system_instruction` is accepted for non-DR agents; DR agents reject it and we prepend to `input` instead.
 *  - No `tools` (yet), no model-side `generation_config`.
 *
 * Source-of-truth snapshots (for diffing across upstream changes, see ./_upstream/sync.sh):
 *   ./_upstream/gemini.interactions.spec.md  - the formal API reference
 *   ./_upstream/gemini.interactions.guide.md - the prose guide
 *   ./_upstream/gemini.deep-research.guide.md - the Deep Research agent guide
 */
export namespace GeminiInteractionsWire_API_Interactions {

  export const postPath = '/v1beta/interactions';

  export const getPath = (id: string) => `/v1beta/interactions/${encodeURIComponent(id)}`;

  // DELETE. Removes the stored record. Orthogonal to cancel; when removed the original connection may still be running and streaming
  export const deletePath = (id: string) => `/v1beta/interactions/${encodeURIComponent(id)}`;

  // POST. Only cancels background interactions that are still running
  export const cancelPath = (id: string) => `/v1beta/interactions/${encodeURIComponent(id)}/cancel`;


  // -- Request Body (POST /v1beta/interactions) --

  // Multimodal content parts (used when a turn carries images/audio in addition to text).
  // Single-modal text turns stay as a plain string to match the API's convenience shape.
  const InputTextPart_schema = z.object({
    type: z.literal('text'),
    text: z.string(),
  });
  const InputImagePart_schema = z.object({
    type: z.literal('image'),
    data: z.string(), // base64-encoded bytes
    mime_type: z.string(), // e.g. 'image/png', 'image/jpeg', 'image/webp'
  });
  export const InputContentPart_schema = z.discriminatedUnion('type', [
    InputTextPart_schema,
    InputImagePart_schema,
  ]);

  // A turn in a stateless multi-turn conversation (when `input` is an array).
  export const Turn_schema = z.object({
    role: z.enum(['user', 'model']),
    content: z.union([
      z.string(), // text-only turn (API convenience shape)
      z.array(InputContentPart_schema), // multimodal turn
    ]),
  });

  // agent_config: polymorphic discriminated union on `type` (formal spec: AgentConfig).
  // Only applicable when `agent` is set (mutually exclusive with `generation_config`, which is the
  // model-path equivalent). See ./_upstream/gemini.interactions.spec.md#agent_config.
  //
  // Variants:
  //  - DynamicAgentConfig  { type: 'dynamic' }
  //    Dynamic agents - no tunable config documented beyond the discriminator.
  //  - DeepResearchAgentConfig  { type: 'deep-research', ... }
  //    See ./_upstream/gemini.deep-research.guide.md#agent-configuration for defaults and semantics.

  const _DynamicAgentConfig_schema = z.object({
    type: z.literal('dynamic'),
  });

  const _DeepResearchAgentConfig_schema = z.object({
    type: z.literal('deep-research'),
    thinking_summaries: z.enum(['auto', 'none']).optional(),   // default 'none'. 'auto' emits intermediate reasoning events during streaming.
    visualization: z.enum(['auto', 'off']).optional(),         // default 'auto'. 'auto' lets the agent generate charts/images as part of the output.
    collaborative_planning: z.boolean().optional(),            // default false. Plan-then-execute: the agent returns a research plan that the user confirms in a follow-up interaction.
  });

  export const AgentConfig_schema = z.discriminatedUnion('type', [
    _DynamicAgentConfig_schema,
    _DeepResearchAgentConfig_schema,
  ]);

  // RequestBody_schema: POST /v1beta/interactions body.
  //
  // Cross-field constraints (from the formal spec):
  //  - `agent` XOR `model` is REQUIRED. We only model the agent path here.
  //  - `agent_config` XOR `generation_config` - config object is picked by path:
  //      `agent`+`agent_config`  OR  `model`+`generation_config`. Never both.
  //  - `system_instruction` is top-level (not inside config) but rejected by deep-research agents.
  //  - `previous_interaction_id` carries conversation history but NOT per-interaction knobs:
  //    `tools`, `system_instruction`, and `generation_config` are interaction-scoped and must be
  //    re-sent each turn.
  export const RequestBody_schema = z.object({
    // --- Target: what to call ---
    agent: z.string(), // Spec: agent is AgentOption (optional, required if `model` not provided). Send the BARE id; no 'models/' prefix.
    // model: z.string(), // alternative path - not used here; would require generation_config instead of agent_config

    // --- Inputs ---
    input: z.union([
      z.string(), // single-turn text convenience (string shortcut for a user-text turn)
      z.array(InputContentPart_schema), // single-turn multimodal (text + image parts for one user turn)
      z.array(Turn_schema), // stateless multi-turn history (role-tagged turns)
    ]),
    system_instruction: z.string().optional(), // NOT supported by deep-research agents (tested 2026-04-23, API: 'not supported for the deep-research-* agent') - for those, prepend to `input` instead.

    // --- Config (picks the agent or model path) ---
    agent_config: AgentConfig_schema.optional(), // Polymorphic on `type`: 'deep-research' | 'dynamic'. MUTUALLY EXCLUSIVE with `generation_config` (model path). Enables thought-summary streaming, visualizations, collaborative planning.
    // generation_config: GenerationConfig_schema.optional(), // model path - not modeled here yet

    // --- Runtime flags (literals below force correct behavior at the adapter layer) ---
    stream: z.boolean().optional(), // SSE streaming - when true, POST returns an event-stream (interaction.start, content.start/delta/stop, interaction.complete, done). On reattach, GET ?stream=true replays the full event sequence (we do not send `last_event_id` - full replay is the intentional semantic; see poller comment).
    store: z.literal(true), // spec-optional; we lock to `true` so the interaction is retrievable post-run (replay via GET stream, resume via `last_event_id`). Required alongside `background=true` for agents per the DR guide.
    background: z.literal(true), // spec-optional; DR agents REQUIRE `true` ('Agents are required to use background=true'). Locked to true to prevent accidental sync-mode sends.

    // --- Multi-turn continuation ---
    previous_interaction_id: z.string().optional(), // reuses prior interaction's stored inputs/outputs. Per-turn knobs (tools, system_instruction, generation_config) are NOT carried and must be re-sent.
  });


  // -- Output blocks --
  //
  // The top-level Output_schema is fully permissive because Deep Research (in preview) sometimes
  // emits blocks without a `type` field or in shapes not yet documented. Validating strictly on
  // ingestion would blow up the entire stream on a single unknown variant.
  //
  // The *known* shapes are defined as sub-schemas below. The parser `safeParse`s each output
  // against `KnownOutput_schema` and skips anything that doesn't match - no casts, no duck-typing.
  export const Output_schema = z.looseObject({});


  // -- Known output variants (parser uses these via safeParse) --

  export const UrlCitationAnnotation_schema = z.looseObject({
    type: z.literal('url_citation'),
    url: z.string(),
    title: z.string().optional(),
    start_index: z.number().optional(),
    end_index: z.number().optional(),
  });

  const TextOutput_schema = z.object({
    type: z.literal('text'),
    text: z.string(),
    // annotations is a heterogeneous array (url_citation, place_citation, file_citation, ...) - we
    // filter it later via `UrlCitationAnnotation_schema.safeParse` per annotation.
    annotations: z.array(z.looseObject({ type: z.string() })).optional(),
  });

  // `thought.summary` is documented as an array of `{type:'text', text}` blocks (ThoughtSummaryContent).
  // Preview builds sometimes emit a bare string; accept either shape to avoid classification drops.
  const ThoughtSummaryItem_schema = z.looseObject({
    type: z.literal('text'),
    text: z.string(),
  });
  const ThoughtOutput_schema = z.object({
    type: z.literal('thought'),
    summary: z.union([z.string(), z.array(ThoughtSummaryItem_schema)]).optional(),
    signature: z.string().optional(),
  });

  const ImageOutput_schema = z.object({
    type: z.literal('image'),
    // API may return inline bytes (`data` + `mime_type`) or a URI. We accept both shapes;
    // the parser prefers inline and falls back to a URI note when only `uri` is present.
    data: z.string().optional(), // base64-encoded bytes
    uri: z.string().optional(),
    mime_type: z.string(),
    resolution: z.string().optional(), // 'low' | 'medium' | 'high' | 'ultra_high'
  });

  const AudioOutput_schema = z.object({
    type: z.literal('audio'),
    // Per docs: data or uri, mime_type covers both PCM (audio/l16) and packaged formats (audio/wav, audio/mp3, ...).
    data: z.string().optional(),
    uri: z.string().optional(),
    mime_type: z.string(),
    rate: z.number().optional(), // sample rate, when known
    channels: z.number().optional(),
  });

  // Deep Research internals: tool calls + results are streamed as content blocks. We recognize their
  // `type` strings but treat them as transient (no user-visible emission here). They're listed as a
  // plain enum so the parser can silent-skip them without trying to schema-parse each variant.
  //
  // Note: `function_call` / `function_result` are INTENTIONALLY absent. Those are the canonical
  // user-facing tool-call format - if the Interactions API is ever used with a model + `tools`,
  // they'd need real handling (start/append/end a function invocation). They fall through to the
  // warn-once path so we notice the moment they appear on this code path.
  export const INTERNAL_OUTPUT_TYPES = new Set<string>([
    'code_execution_call', 'code_execution_result',
    'url_context_call', 'url_context_result',
    'google_search_call', 'google_search_result',
    'google_maps_call', 'google_maps_result',
    'file_search_call', 'file_search_result',
    'mcp_server_tool_call', 'mcp_server_tool_result',
  ]);

  /** Discriminated union of output shapes we emit to the UI. Everything else is either silently skipped
   *  (INTERNAL_OUTPUT_TYPES) or warned as unknown by the parser. */
  export const KnownOutput_schema = z.discriminatedUnion('type', [
    TextOutput_schema,
    ThoughtOutput_schema,
    ImageOutput_schema,
    AudioOutput_schema,
  ]);


  // -- Response: Create / Get --

  export const Status_enum = z.enum([
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'requires_action',
    'incomplete', // run stopped early (e.g. token limit) - terminate gracefully with a note
  ]);

  // -- Usage (populated in the terminal frame) --

  // Modality enum: per spec ResponseModality - ISO 8601 in descriptions clarifies this is the
  // runtime modality, not the model's response_modalities request field.
  const UsageByModality_schema = z.object({
    modality: z.enum(['text', 'image', 'audio', 'video', 'document']).or(z.string()), // permissive for future modalities
    tokens: z.number(),
  });

  const Usage_schema = z.object({
    total_tokens: z.number().optional(),
    total_input_tokens: z.number().optional(),
    total_cached_tokens: z.number().optional(),
    total_output_tokens: z.number().optional(),
    total_thought_tokens: z.number().optional(),
    total_tool_use_tokens: z.number().optional(),                       // Deep Research: tokens consumed by internal tool calls (web search, etc.)
    input_tokens_by_modality: z.array(UsageByModality_schema).optional(),
    cached_tokens_by_modality: z.array(UsageByModality_schema).optional(),   // spec: cached-tokens breakdown (input subset)
    output_tokens_by_modality: z.array(UsageByModality_schema).optional(),
    tool_use_tokens_by_modality: z.array(UsageByModality_schema).optional(), // spec: tool-use breakdown - DR search/urlcontext/code-exec consumption per modality
  });

  // Full Interaction resource (spec: Resource:Interaction). We model ALL required fields and the
  // ones we observe in responses; remaining optional echo fields are left as `.passthrough()` - see
  // `Output_schema` comment for rationale.
  export const Interaction_schema = z.looseObject({
    // required (all marked "Required. Output only." in spec)
    id: z.string(),
    status: Status_enum,
    created: z.string().optional(),   // ISO 8601 - spec says Required but marked optional-with-default upstream; we keep optional for forward-compat
    updated: z.string().optional(),   // ISO 8601

    // commonly-observed fields
    role: z.string().optional(),      // 'agent' | 'user' | ... - output only
    object: z.string().optional(),    // 'interaction' literal observed in responses
    agent: z.string().optional(),     // echoed back on agent-path interactions
    model: z.string().optional(),     // echoed back on model-path interactions

    // content + metrics
    outputs: z.array(Output_schema).optional(), // absent until first content arrives
    usage: Usage_schema.optional(),             // populated in terminal frames (completed/failed/cancelled/incomplete)

    // (remaining echo fields - system_instruction, tools, agent_config, previous_interaction_id,
    //  input, response_modalities, response_format, etc. - pass through via looseObject for now)
  });


  // -- SSE Stream Events --
  //
  // When the POST (or resume GET) is sent with `stream=true`, the API returns `text/event-stream`
  // with the following frames (captured empirically 2026-04-23, see _upstream/gemini.deep-research.guide.md#streaming):
  //
  //   event: interaction.start          one at the top; carries { interaction: {id, status, agent, ...} }
  //   event: interaction.status_update  status transitions (in_progress, completed, ...)
  //   event: content.start              opens a content block at {index, content:{type:'thought'|'text'|...}}
  //   event: content.delta              incremental data for index; polymorphic delta (see below); some carry `event_id` for resume
  //   event: content.stop               closes a content block at index
  //   event: error                      spec shape: { error?: { code, message } }; observed with EMPTY payload in Beta - non-fatal, continue
  //   event: interaction.complete       final snapshot carrying the full Interaction incl. usage
  //   event: done                       terminator with data: [DONE] (OpenAI-style)
  //
  // Resume: GET /v1beta/interactions/{id}?stream=true
  //   Spec also allows `&last_event_id=<event_id>` for incremental resume, but we do NOT use it.
  //   Full replay from the beginning is the intentional semantic - the client's ContentReassembler
  //   REPLACES message content on reattach, so partial resume would be a mismatch. Works identically
  //   on in-progress, completed, failed, and cancelled interactions (within Gemini's retention window).

  // --- ContentDeltaData variants (spec: polymorphic on `type`) ---
  //
  // Spec defines: text, image, audio, document, video, thought_summary, thought_signature,
  // text_annotation, function_call, + tool-call/result variants (code_execution_*, url_context_*,
  // google_search_*, google_maps_*, file_search_*, mcp_server_tool_*). We model variants we emit
  // to the UI; unknown ones fail safeParse at the parser and are silently dropped (mirrors the
  // INTERNAL_OUTPUT_TYPES policy on the non-streaming path).

  const TextDelta_schema = z.object({
    type: z.literal('text'),
    text: z.string(),
  });

  const ThoughtSummaryDelta_schema = z.object({
    type: z.literal('thought_summary'),
    // Spec: ThoughtSummaryContent - polymorphic (only `text` variant documented). Optional per spec.
    content: z.object({
      type: z.literal('text'),
      text: z.string(),
    }).optional(),
  });

  // Backend validation hash - routed to `pt.setReasoningSignature` when present.
  const ThoughtSignatureDelta_schema = z.object({
    type: z.literal('thought_signature'),
    signature: z.string().optional(),
  });

  // text_annotation arrives as its own delta on the same index as a text block, carrying citation metadata for the text already emitted.
  const TextAnnotationDelta_schema = z.object({
    type: z.literal('text_annotation'),
    // Spec: Annotation - polymorphic on `type` (url_citation, file_citation, place_citation). Optional per spec.
    annotations: z.array(z.looseObject({ type: z.string() })).optional(), // validated per-item via UrlCitationAnnotation_schema
  });

  const ImageDelta_schema = z.object({
    type: z.literal('image'),
    data: z.string().optional(),     // base64
    uri: z.string().optional(),
    mime_type: z.string().optional(), // spec enum: image/png, image/jpeg, image/webp, image/heic, image/heif, image/gif, image/bmp, image/tiff
    resolution: z.enum(['low', 'medium', 'high', 'ultra_high']).optional(), // spec: MediaResolution
  });

  const AudioDelta_schema = z.object({
    type: z.literal('audio'),
    data: z.string().optional(),
    uri: z.string().optional(),
    mime_type: z.string().optional(), // spec enum: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg, audio/flac, audio/mpeg, audio/m4a, audio/l16, audio/opus, audio/alaw, audio/mulaw
    rate: z.number().optional(),
    channels: z.number().optional(),
  });

  // Delta discriminated union - covers variants we emit to the UI. Unknown variants (document,
  // video, function_call, + tool-call/result) fail safeParse in the parser and are silently dropped.
  export const StreamDelta_schema = z.discriminatedUnion('type', [
    TextDelta_schema,
    ImageDelta_schema,
    AudioDelta_schema,
    ThoughtSummaryDelta_schema,
    ThoughtSignatureDelta_schema,
    TextAnnotationDelta_schema,
  ]);

  // --- SSE event data payloads (spec: InteractionSseEvent - polymorphic on `event_type`) ---
  //
  // Per spec, EVERY variant carries an OPTIONAL `event_id` resume cursor. At runtime only a subset
  // of events actually include one, so the schema accepts it on all but our parser uses whichever
  // is present to advance the cursor.

  const InteractionStart_event_schema = z.object({
    event_type: z.literal('interaction.start'),
    interaction: Interaction_schema.partial().extend({ id: z.string(), status: Status_enum.optional() }),
    event_id: z.string().optional(),
  });

  const InteractionStatusUpdate_event_schema = z.object({
    event_type: z.literal('interaction.status_update'),
    interaction_id: z.string(),
    status: Status_enum,
    event_id: z.string().optional(),
  });

  const ContentStart_event_schema = z.object({
    event_type: z.literal('content.start'),
    index: z.number(),
    content: z.looseObject({ type: z.string() }), // spec: Content (polymorphic)
    event_id: z.string().optional(),
  });

  const ContentDelta_event_schema = z.object({
    event_type: z.literal('content.delta'),
    index: z.number(),
    delta: z.looseObject({}), // spec: ContentDeltaData - tolerant at ingest; parsed later via StreamDelta_schema.safeParse
    event_id: z.string().optional(),
  });

  const ContentStop_event_schema = z.object({
    event_type: z.literal('content.stop'),
    index: z.number(),
    event_id: z.string().optional(),
  });

  const Error_event_schema = z.object({
    event_type: z.literal('error'),
    // Spec: Error (optional) - { code?: string (URI), message?: string }. Observed empty in Beta.
    error: z.object({
      code: z.string().optional(),
      message: z.string().optional(),
    }).optional(),
    event_id: z.string().optional(),
  });

  const InteractionComplete_event_schema = z.object({
    event_type: z.literal('interaction.complete'),
    // Spec note: "The completed interaction with EMPTY OUTPUTS to reduce the payload size. Use the
    // preceding ContentDelta events for the actual output." We rely on `status` + `usage` here.
    interaction: Interaction_schema,
    event_id: z.string().optional(),
  });

  // `event: done` carries the literal string `[DONE]` instead of JSON; handled specially in the parser

  /** Discriminated union of JSON-bodied SSE events. The `done` terminator is handled as a string-valued special case in the parser. */
  export const StreamEvent_schema = z.discriminatedUnion('event_type', [
    InteractionStart_event_schema,
    InteractionStatusUpdate_event_schema,
    ContentStart_event_schema,
    ContentDelta_event_schema,
    ContentStop_event_schema,
    Error_event_schema,
    InteractionComplete_event_schema,
  ]);

}
