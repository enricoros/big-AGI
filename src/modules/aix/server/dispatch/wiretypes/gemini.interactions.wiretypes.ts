import * as z from 'zod/v4';


/**
 * Gemini Interactions API wiretypes (Beta)
 *
 * 2026-04-21: NOTE - MINIMAL IMPL for DEEP RESEARCH AGENT
 * Scope: only what the Deep Research + Antigravity agents need.
 *  - Single-turn by default (we don't yet send `previous_interaction_id` for multi-turn state reuse)
 *  - `store: true` is sent (spec says optional; DR guide recommends it for background runs).
 *    We best-effort DELETE on completion/abort to minimize server-side retention.
 *  - `system_instruction` is accepted for non-DR agents; DR agents reject it and we prepend to `input` instead.
 *  - No `tools` (yet), no model-side `generation_config`.
 *
 * ============================================================================
 * 2026-06-02: MIGRATED to the "steps" schema (the 2026-05-26 default flip).
 * ============================================================================
 * Google replaced the legacy `outputs[]` response with a typed `steps[]` timeline and
 * renamed the SSE events. The legacy schema is REMOVED on 2026-06-08. We always rode
 * Google's default (no `Api-Revision` header was ever sent), so the default flip on
 * 2026-05-26 broke the legacy parser - this file + the parser + the dispatch (request build)
 * are the migration. Mapping (legacy -> new):
 *   outputs[]                 -> steps[] (Step union; text/image/audio nested in `model_output.content[]`)
 *   interaction.start         -> interaction.created
 *   interaction.status_update -> interaction.status_update (kept) | interaction.in_progress | interaction.requires_action
 *   content.start/delta/stop  -> step.start/delta/stop  (keyed to typed steps)
 *   interaction.complete      -> interaction.completed
 *   delta type 'text_annotation' -> 'text_annotation_delta'
 *   (new) delta type 'arguments_delta' for streamed client function-call args
 *   (new) status 'budget_exceeded'
 * Request side is unchanged EXCEPT multi-turn `input`: `{role,content}` turns are now
 * `{type:'user_input'|'model_output', content[]}` steps. We never sent response_mime_type /
 * image_config, so the `response_format` consolidation does not touch us.
 *
 * We rely on Google's DEFAULT schema (steps, since the 2026-05-26 flip) and deliberately do NOT send
 * an `Api-Revision` header: it is not CORS-safelisted, so on the client-side-fetch (direct browser->
 * Google) path it forces a preflight the endpoint rejects, breaking direct connections. The header was
 * only useful to opt in BEFORE the default flip, which has passed.
 *
 * Migration guide: https://ai.google.dev/gemini-api/docs/interactions-breaking-changes-may-2026
 * ============================================================================
 *
 * Source-of-truth snapshots (for diffing across upstream changes, see ./_upstream/sync.sh):
 *   ./_upstream/gemini.interactions.spec.md  - the formal API reference
 *   ./_upstream/gemini.interactions.guide.md - the prose guide
 *   ./_upstream/gemini.deep-research.guide.md - the Deep Research agent guide
 *   ./_upstream/gemini.interactions.breaking-changes.md - the May-2026 migration guide
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

  // A turn in stateless multi-turn history (when `input` is an array of steps). The new schema replaces
  // the legacy `{role:'user'|'model', content}` turn with a typed input step: `user_input` / `model_output`,
  // whose `content` is an array of Content parts (the API also accepts a bare string at the top-level input,
  // but each history step carries an explicit content-part array).
  export const InputStep_schema = z.object({
    type: z.enum(['user_input', 'model_output']),
    content: z.array(InputContentPart_schema),
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
  //
  // Note: the Antigravity Agent (antigravity-preview-05-2026, released 2026-05-19) does NOT use
  // `agent_config` - it is configured via the top-level `environment` and `tools` fields instead.

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
      z.array(InputStep_schema), // stateless multi-turn history (typed input steps: user_input / model_output)
    ]),
    system_instruction: z.string().optional(), // NOT supported by deep-research agents (tested 2026-04-23, API: 'not supported for the deep-research-* agent') - for those, prepend to `input` instead.

    // --- Config (picks the agent or model path) ---
    agent_config: AgentConfig_schema.optional(), // Polymorphic on `type`: 'deep-research' | 'dynamic'. MUTUALLY EXCLUSIVE with `generation_config` (model path). Enables thought-summary streaming, visualizations, collaborative planning.
    // generation_config: GenerationConfig_schema.optional(), // model path - not modeled here yet

    // --- Sandbox (Antigravity Agent + future managed agents) ---
    // `environment` is the top-level sandbox handle on the agent path. Accepts the literal "remote"
    // (fresh sandbox with defaults), an existing env id string (reuses sandbox state across turns),
    // or an `EnvironmentConfig` object (custom sources / network rules). DR agents ignore this field.
    environment: z.union([z.string(), z.looseObject({})]).optional(),

    // --- Runtime flags (literals below force correct behavior at the adapter layer) ---
    stream: z.boolean().optional(), // SSE streaming - when true, POST returns an event-stream (interaction.created, step.start/delta/stop, interaction.completed). On reattach, GET ?stream=true replays the full event sequence (we do not send `last_event_id` - full replay is the intentional semantic; see poller comment).
    /**
     * spec-optional; we lock to `true` so the interaction is retrievable post-run
     * Required by DR agents AND by Antigravity Agent.
     */
    store: z.literal(true),
    /**
     * spec-optional, but we mandate it for clarity:
     * - DR agents REQUIRE `true` ('Agents are required to use background=true').
     * - Antigravity Agent REJECTS `true` ('does not support using background=True'). Adapter sets per-agent.
     */
    background: z.boolean(),

    // --- Multi-turn continuation ---
    previous_interaction_id: z.string().optional(), // reuses prior interaction's stored inputs/outputs. Per-turn knobs (tools, system_instruction, generation_config) are NOT carried and must be re-sent.
  });


  // -- Content blocks (model_output.content[] and user_input.content[]) --
  //
  // Content is permissive at ingest (looseObject) because preview builds occasionally emit
  // undocumented shapes; the parser `safeParse`s each block against `KnownContent_schema` and
  // skips anything that doesn't match - no casts, no duck-typing.
  export const Content_schema = z.looseObject({});

  export const UrlCitationAnnotation_schema = z.looseObject({
    type: z.literal('url_citation'),
    url: z.string(),
    title: z.string().optional(),
    start_index: z.number().optional(),
    end_index: z.number().optional(),
  });

  const TextContent_schema = z.object({
    type: z.literal('text'),
    text: z.string(),
    // annotations is a heterogeneous array (url_citation, place_citation, file_citation, ...) - we
    // filter it later via `UrlCitationAnnotation_schema.safeParse` per annotation.
    annotations: z.array(z.looseObject({ type: z.string() })).optional(),
  });

  const ImageContent_schema = z.object({
    type: z.literal('image'),
    // API may return inline bytes (`data` + `mime_type`) or a URI. We accept both shapes;
    // the parser prefers inline and falls back to a URI note when only `uri` is present.
    data: z.string().optional(), // base64-encoded bytes
    uri: z.string().optional(),
    mime_type: z.string().optional(), // spec: optional - parser still requires it before emitting inline
    resolution: z.string().optional(), // 'low' | 'medium' | 'high' | 'ultra_high'
  });

  const AudioContent_schema = z.object({
    type: z.literal('audio'),
    // Per docs: data or uri, mime_type covers both PCM (audio/l16) and packaged formats (audio/wav, audio/mp3, ...).
    data: z.string().optional(),
    uri: z.string().optional(),
    mime_type: z.string().optional(), // spec: optional - parser still requires it before emitting inline
    sample_rate: z.number().optional(), // sample rate, when known (spec renamed `rate` -> `sample_rate`)
    channels: z.number().optional(),
  });

  /** Content blocks we emit to the UI (inside model_output steps). Everything else is skipped by the parser. */
  export const KnownContent_schema = z.discriminatedUnion('type', [
    TextContent_schema,
    ImageContent_schema,
    AudioContent_schema,
  ]);

  // `thought.summary` is documented as ThoughtSummaryContent (array of `{type:'text', text}` blocks).
  // Preview builds sometimes emit a bare string; accept either shape to avoid classification drops.
  const ThoughtSummaryItem_schema = z.looseObject({
    type: z.literal('text'),
    text: z.string(),
  });
  export const ThoughtSummary_schema = z.union([z.string(), z.array(ThoughtSummaryItem_schema)]);


  // -- Steps (the response timeline: outputs[] -> steps[]) --
  //
  // Each step is a typed entry in the interaction timeline. `model_output` carries the user-facing
  // content[] (text/image/audio); `thought` carries reasoning summaries; the *_call / *_result steps
  // are tool invocations. The NS parser `safeParse`s each step against the known shapes below and skips
  // unknown / internal ones (mirrors the SSE parser policy).
  export const Step_schema = z.looseObject({});

  const ModelOutputStep_schema = z.object({
    type: z.literal('model_output'),
    content: z.array(Content_schema).optional(),
  });

  const ThoughtStep_schema = z.object({
    type: z.literal('thought'),
    summary: ThoughtSummary_schema.optional(),
    signature: z.string().optional(),
  });

  // Steps the NS parser turns into user-facing fragments. user_input is intentionally NOT here -
  // the GET timeline echoes our own input back and we don't re-render it (the parser skips it explicitly).
  export const KnownStep_schema = z.discriminatedUnion('type', [
    ModelOutputStep_schema,
    ThoughtStep_schema,
  ]);

  // -- Surfaced tool steps (Antigravity sandbox) --
  //
  // In the steps schema, sandbox tool calls/results arrive as typed STEPS (step.start `step`) and may
  // also stream incremental args/results via step.delta. These explicit per-tool schemas (vs a loose
  // read) give the parser type-safe field access. Most fields are `.optional()` because step.start
  // carries a minimal shell - e.g. `function_call` arrives with `arguments:{}` and the real args stream
  // via `arguments_delta`; a `function_result` step.start is just `{call_id,type}` with the result on a
  // following step.delta. Only the discriminator + the id/call_id we pair chips on are required. Extra
  // upstream fields pass through (objects are non-strict). Field names per spec Step possible-types.

  const FunctionCallStep_schema = z.object({
    type: z.literal('function_call'),
    id: z.string(),                              // Required. Pairs with FunctionResultStep.call_id.
    name: z.string().optional(),                 // spec: required; tolerated optional
    arguments: z.looseObject({}).optional(),     // empty `{}` in step.start; full args stream via arguments_delta
    signature: z.string().optional(),
  });
  const CodeExecutionCallStep_schema = z.object({
    type: z.literal('code_execution_call'),
    id: z.string(),
    arguments: z.object({ code: z.string().optional(), language: z.string().optional() }).optional(), // `{code}` arrives via typed step.delta
    signature: z.string().optional(),
  });
  const UrlContextCallStep_schema = z.object({
    type: z.literal('url_context_call'),
    id: z.string(),
    arguments: z.object({ url: z.string().optional(), urls: z.array(z.string()).optional() }).optional(),
    signature: z.string().optional(),
  });
  const GoogleSearchCallStep_schema = z.object({
    type: z.literal('google_search_call'),
    id: z.string(),
    arguments: z.object({ queries: z.array(z.string()).optional(), query: z.string().optional() }).optional(), // spec def: `queries`; spec example uses `query`
    search_type: z.string().optional(),          // 'web_search' | 'image_search' | 'enterprise_web_search'
    signature: z.string().optional(),
  });
  const FunctionResultStep_schema = z.object({
    type: z.literal('function_result'),
    call_id: z.string(),                         // Required. Matches the FunctionCallStep.id.
    name: z.string().optional(),
    result: z.unknown().optional(),              // FunctionResultSubcontent[] | string | object
    is_error: z.boolean().optional(),
    signature: z.string().optional(),
  });
  const CodeExecutionResultStep_schema = z.object({
    type: z.literal('code_execution_result'),
    call_id: z.string(),
    result: z.unknown().optional(),              // stdout+stderr (normally a string; unknown so a non-string never fails the parse - parser stringifies)
    is_error: z.boolean().optional(),
    signature: z.string().optional(),
  });
  const UrlContextResultStep_schema = z.object({
    type: z.literal('url_context_result'),
    call_id: z.string(),
    result: z.unknown().optional(),              // UrlContextResultItem | array (shape varies spec def vs example)
    is_error: z.boolean().optional(),
    signature: z.string().optional(),
  });
  const GoogleSearchResultStep_schema = z.object({
    type: z.literal('google_search_result'),
    call_id: z.string(),
    result: z.unknown().optional(),              // { search_suggestions } | array (shape varies spec def vs example)
    is_error: z.boolean().optional(),
    signature: z.string().optional(),
  });

  /** Discriminated union of the Antigravity sandbox tool steps we surface as op-state chips. The parser
   *  `safeParse`s the raw step (or a delta-synthesized {type,id/call_id,...}) against this for typed access. */
  export const SurfacedToolStep_schema = z.discriminatedUnion('type', [
    // late parsed calls
    FunctionCallStep_schema, CodeExecutionCallStep_schema, UrlContextCallStep_schema, GoogleSearchCallStep_schema,
    // late parsed results
    FunctionResultStep_schema, CodeExecutionResultStep_schema, UrlContextResultStep_schema, GoogleSearchResultStep_schema,
  ]);
  // export type TSurfacedToolStep = z.infer<typeof SurfacedToolStep_schema>;

  // Fast type-string routing (the parser checks these before parsing a loose step/delta). Kept in sync with SurfacedToolStep_schema above.
  export const SURFACED_TOOL_CALL_TYPES = new Set<string>([
    'function_call', 'code_execution_call', 'url_context_call', 'google_search_call',
  ]);
  export const SURFACED_TOOL_RESULT_TYPES = new Set<string>([
    'function_result', 'code_execution_result', 'google_search_result', 'url_context_result',
  ]);

  // Tool steps we do NOT surface (not part of Antigravity's default set, or carry payloads not useful as chip detail). Silent-skipped on both the SSE and NS paths.
  export const SILENCE_STEP_TYPES = new Set<string>([
    'google_maps_call', 'google_maps_result',
    'file_search_call', 'file_search_result',
    'mcp_server_tool_call', 'mcp_server_tool_result',
  ]);


  // -- Response: Create / Get --

  export const Status_enum = z.enum([
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'requires_action',
    'incomplete',       // run stopped early (e.g. token limit) - terminate gracefully with a note
    'budget_exceeded',  // new in the steps schema - run hit a spend/compute budget cap; treat as terminal
  ]);

  // -- Usage (populated in the terminal frame) -- UNCHANGED across the steps migration.

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
  // `Step_schema` comment for rationale.
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

    // session/sandbox handle for managed agents (today: Antigravity); forward-carried via the request `environment` field. Lifecycle per docs: Idle after 15min, retained 7d since last-active, then deleted. Wire doesn't expose `environment_expires_at`; parser derives `now + 7d` for the walk's expiry gate.
    environment_id: z.string().optional(),

    // content + metrics
    steps: z.array(Step_schema).optional(), // outputs[] -> steps[]. Absent until first content arrives; in interaction.completed it is empty (use preceding step.delta events).
    usage: Usage_schema.optional(),         // populated in terminal frames (completed/failed/cancelled/incomplete/budget_exceeded)

    // (remaining echo fields - system_instruction, tools, agent_config, previous_interaction_id,
    //  input, response_modalities, response_format, etc. - pass through via looseObject for now)
  });


  // -- SSE Stream Events --
  //
  // When the POST (or resume GET) is sent with `stream=true`, the API returns `text/event-stream`
  // with the following frames (steps schema; see _upstream/gemini.interactions.breaking-changes.md#streaming):
  //
  //   event: interaction.created          one at the top; carries { interaction: {id, status, model/agent, ...} }
  //   event: interaction.status_update    status transitions (in_progress, completed, ...); carries { interaction_id, status }
  //   event: interaction.in_progress      (migration-guide variant of status_update -> in_progress); carries { interaction_id }
  //   event: interaction.requires_action  (migration-guide variant of status_update -> requires_action); carries { interaction_id }
  //   event: step.start                   opens a step at {index, step:{type:'model_output'|'thought'|'<tool>_call'|...}}
  //   event: step.delta                   incremental data for index; polymorphic delta (see below); some carry `event_id` for resume
  //   event: step.stop                    closes a step at index
  //   event: error                        spec shape: { error?: { code, message } }; observed with EMPTY payload in Beta - non-fatal, continue
  //   event: interaction.completed        final snapshot carrying the full Interaction incl. usage (steps[] empty to reduce payload)
  //   event: done                         legacy terminator with data: [DONE]; not part of the steps SSE union but kept defensively
  //
  // Resume: GET /v1beta/interactions/{id}?stream=true
  //   Spec also allows `&last_event_id=<event_id>` for incremental resume, but we do NOT use it.
  //   Full replay from the beginning is the intentional semantic - the client's ContentReassembler
  //   REPLACES message content on reattach, so partial resume would be a mismatch.

  // --- StepDeltaData variants (spec: polymorphic on `type`) ---
  //
  // Spec defines: text, image, audio, document, video, thought_summary, thought_signature,
  // text_annotation_delta, arguments_delta, + tool-call/result variants (code_execution_*, url_context_*,
  // google_search_*, google_maps_*, file_search_*, mcp_server_tool_*, function_result). We model variants
  // we emit to the UI; unknown ones fail safeParse at the parser and are routed/dropped there.

  const TextDelta_schema = z.object({
    type: z.literal('text'),
    text: z.string(),
  });

  const ThoughtSummaryDelta_schema = z.object({
    type: z.literal('thought_summary'),
    // Spec: ThoughtSummaryContent is polymorphic (text | image); only the `text` variant is surfaced.
    // looseObject (text optional) keeps a non-text summary item from failing the union and getting
    // warn-dropped - the parser emits only when `content.text` is a present string.
    content: z.looseObject({ type: z.string(), text: z.string().optional() }).optional(),
  });

  // Backend validation hash - routed to `pt.setReasoningSignature` when present.
  const ThoughtSignatureDelta_schema = z.object({
    type: z.literal('thought_signature'),
    signature: z.string().optional(),
  });

  // text_annotation_delta (legacy: text_annotation) arrives on the same index as a text block, carrying
  // citation metadata for the text already emitted.
  const TextAnnotationDelta_schema = z.object({
    type: z.literal('text_annotation_delta'),
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
    sample_rate: z.number().optional(), // spec renamed `rate` -> `sample_rate` (rate kept deprecated upstream; we read sample_rate)
    rate: z.number().optional(),         // deprecated alias - tolerated for forward/backward compat
    channels: z.number().optional(),
  });

  // arguments_delta: streamed partial-JSON args for a client function_call step (accumulate to get the
  // full arguments). We don't execute client tools on this path, so we tolerate but don't act on these.
  const ArgumentsDelta_schema = z.object({
    type: z.literal('arguments_delta'),
    arguments: z.string().optional(),
  });

  // Delta discriminated union - covers variants we emit to the UI. Unknown variants (document, video,
  // tool-call/result deltas) fail safeParse in the parser and are handled by the tool-surfacing branch
  // or silently dropped.
  export const StreamDelta_schema = z.discriminatedUnion('type', [
    TextDelta_schema,
    ImageDelta_schema,
    AudioDelta_schema,
    ThoughtSummaryDelta_schema,
    ThoughtSignatureDelta_schema,
    TextAnnotationDelta_schema,
    ArgumentsDelta_schema,
  ]);

  // --- SSE event data payloads (spec: InteractionSseEvent - polymorphic on `event_type`) ---
  //
  // Per spec, EVERY variant carries an OPTIONAL `event_id` resume cursor. At runtime only a subset
  // of events actually include one, so the schema accepts it on all but our parser uses whichever
  // is present to advance the cursor.

  const InteractionCreated_event_schema = z.object({
    event_type: z.literal('interaction.created'),
    interaction: Interaction_schema.partial().extend({ id: z.string(), status: Status_enum.optional() }),
    event_id: z.string().optional(),
  });

  const InteractionStatusUpdate_event_schema = z.object({
    event_type: z.literal('interaction.status_update'),
    interaction_id: z.string(),
    status: Status_enum,
    event_id: z.string().optional(),
  });

  // Migration-guide variants of status_update (formal spec lists only status_update, but the guide's
  // streaming example emits these). Tolerated so we react correctly whichever Google sends. They carry
  // `interaction_id` and no `status` field (the status is implied by the event name).
  const InteractionInProgress_event_schema = z.object({
    event_type: z.literal('interaction.in_progress'),
    interaction_id: z.string().optional(),
    event_id: z.string().optional(),
  });

  const InteractionRequiresAction_event_schema = z.object({
    event_type: z.literal('interaction.requires_action'),
    interaction_id: z.string().optional(),
    event_id: z.string().optional(),
  });

  const StepStart_event_schema = z.object({
    event_type: z.literal('step.start'),
    index: z.number(),
    step: z.looseObject({ type: z.string() }), // spec: Step (polymorphic) - carries the step type + (for tool steps) id/name/arguments/call_id/result
    event_id: z.string().optional(),
  });

  const StepDelta_event_schema = z.object({
    event_type: z.literal('step.delta'),
    index: z.number(),
    delta: z.looseObject({}), // spec: StepDeltaData - tolerant at ingest; parsed later via StreamDelta_schema.safeParse / tool-surfacing
    event_id: z.string().optional(),
  });

  const StepStop_event_schema = z.object({
    event_type: z.literal('step.stop'),
    index: z.number(),
    status: z.string().optional(), // some frames carry a per-step status (e.g. 'done')
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

  const InteractionCompleted_event_schema = z.object({
    event_type: z.literal('interaction.completed'),
    // Spec note: "The completed interaction with EMPTY OUTPUTS to reduce the payload size. Use the
    // preceding StepDelta events for the actual output." We rely on `status` + `usage` here.
    interaction: Interaction_schema,
    event_id: z.string().optional(),
  });

  // `event: done` carries the literal string `[DONE]` instead of JSON; handled specially in the parser

  /** Discriminated union of JSON-bodied SSE events. The `done` terminator is handled as a string-valued special case in the parser. */
  export const StreamEvent_schema = z.discriminatedUnion('event_type', [
    InteractionCreated_event_schema,
    InteractionStatusUpdate_event_schema,
    InteractionInProgress_event_schema,
    InteractionRequiresAction_event_schema,
    StepStart_event_schema,
    StepDelta_event_schema,
    StepStop_event_schema,
    Error_event_schema,
    InteractionCompleted_event_schema,
  ]);

}
