import * as z from 'zod/v4';


/**
 * Gemini Interactions API wiretypes (Beta)
 *
 * 2026-04-21: NOTE - MINIMAL IMPL for DEEP RESEARCH AGENT
 * Scope: only what the Deep Research agents need.
 *  - Stateless (no `previous_interaction_id`)
 *  - `store: true` - required by the API when `background: true` (Deep Research agents are background-only).
 *    We best-effort DELETE on completion/abort to minimize server-side retention.
 *  - Single-turn: last user text becomes `input`
 *  - No tools, no system_instruction, no thinking config
 *
 * Docs: https://ai.google.dev/gemini-api/docs/interactions
 *       https://ai.google.dev/api/interactions-api
 */
export namespace GeminiInteractionsWire_API_Interactions {

  export const postPath = '/v1beta/interactions';

  export const getPath = (id: string) => `/v1beta/interactions/${encodeURIComponent(id)}`;

  export const deletePath = (id: string) => `/v1beta/interactions/${encodeURIComponent(id)}`;


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

  export const RequestBody_schema = z.object({
    agent: z.string(), // e.g. 'deep-research-pro-preview-12-2025' (note: we send bare id, without 'models/' prefix)
    input: z.union([
      z.string(), // single-turn text convenience
      z.array(InputContentPart_schema), // single-turn multimodal
      z.array(Turn_schema), // stateless multi-turn history
    ]),
    background: z.literal(true), // required for agents
    store: z.literal(true), // required when background=true; we DELETE after completion to minimize retention
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

  const ThoughtOutput_schema = z.object({
    type: z.literal('thought'),
    summary: z.string().optional(), // may be absent on simple/minimal thinking
    signature: z.string().optional(),
  });

  const ImageOutput_schema = z.object({
    type: z.literal('image'),
    // API may return inline bytes (`data` + `mime_type`) or a URI. We accept both shapes;
    // the parser prefers inline and falls back to a URI note when only `uri` is present.
    data: z.string().optional(), // base64-encoded bytes
    uri: z.string().optional(),
    mime_type: z.string(),
  });

  const AudioOutput_schema = z.object({
    type: z.literal('audio'),
    data: z.string(), // base64-encoded bytes (Gemini serves PCM; parser converts to WAV)
    mime_type: z.string(), // e.g. 'audio/L16;codec=pcm;rate=24000'
  });

  /** Discriminated union of output shapes we act on. Anything else: safeParse fails -> parser warns once per index. */
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
  ]);

  // -- Usage (populated in the terminal frame) --

  const UsageByModality_schema = z.object({
    modality: z.string(), // 'text' | 'image' | 'audio' | ...
    tokens: z.number(),
  });

  const Usage_schema = z.object({
    total_tokens: z.number().optional(),
    total_input_tokens: z.number().optional(),
    total_cached_tokens: z.number().optional(),
    total_output_tokens: z.number().optional(),
    total_thought_tokens: z.number().optional(),
    total_tool_use_tokens: z.number().optional(), // Deep Research: tokens consumed by internal tool calls (web search, etc.)
    input_tokens_by_modality: z.array(UsageByModality_schema).optional(),
    output_tokens_by_modality: z.array(UsageByModality_schema).optional(),
  });

  export const Interaction_schema = z.object({
    id: z.string(),
    status: Status_enum,
    outputs: z.array(Output_schema).optional(), // absent until first content arrives
    usage: Usage_schema.optional(), // populated in terminal frames (completed/failed/cancelled)
    // We ignore model/agent echo for now
  });

}
