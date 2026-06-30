import * as z from 'zod/v4';


/**
 * [Cerebras, 2026-06-30] Rich public model catalog: https://api.cerebras.ai/public/v1/models
 *
 * Far more metadata than the minimal authenticated `/v1/models` (which only returns id/created/owned_by).
 * Deliberately RELAXED for forward-compatibility:
 * - only `id` is required; every other field is optional/nullish so new models never fail to parse
 * - enums accept future string values (`.or(z.string())`)
 * - new top-level fields are simply ignored
 *
 * NOTE: the catalog's metadata is NOT always reliable for preview models (e.g. as of 2026-06-30 it
 * reports `gemma-4-31b` with all capabilities false and an 8K context, which is wrong). Hence the
 * editorial table in cerebras.models.ts wins for KNOWN models; this API data only fills UNKNOWN ones.
 */
const _wireCerebrasModelSchema = z.object({
  id: z.string(),
  object: z.string().nullish(),
  created: z.number().nullish(),         // unix seconds; often 0 for preview models
  owned_by: z.string().nullish(),
  name: z.string().nullish(),            // human-readable label
  description: z.string().nullish(),
  hugging_face_id: z.string().nullish(),

  // dollar-per-token as strings, e.g. "0.00000035", "3.5e-7", "0"
  pricing: z.object({
    prompt: z.string().nullish(),
    completion: z.string().nullish(),
  }).nullish(),

  // boolean capability flags (all optional - absent means unknown/false)
  capabilities: z.object({
    streaming: z.boolean().nullish(),
    function_calling: z.boolean().nullish(),
    structured_outputs: z.boolean().nullish(),
    vision: z.boolean().nullish(),
    json_mode: z.boolean().nullish(),
    tools: z.boolean().nullish(),
    tool_choice: z.boolean().nullish(),
    parallel_tool_calls: z.boolean().nullish(),
    response_format: z.boolean().nullish(),
    reasoning: z.boolean().nullish(),
  }).nullish(),

  architecture: z.object({
    modality: z.string().nullish(),      // 'text'; future: 'text+image', 'image', ...
    tokenizer: z.string().nullish(),
    instruct_type: z.string().nullish(),
  }).nullish(),

  limits: z.object({
    max_context_length: z.number().nullish(),
    max_completion_tokens: z.number().nullish(),
    requests_per_minute: z.number().nullish(),
    tokens_per_minute: z.number().nullish(),
  }).nullish(),

  deprecated: z.boolean().nullish(),
  preview: z.boolean().nullish(),
  quantization: z.string().nullish(),
});

export type WireCerebrasModel = z.infer<typeof _wireCerebrasModelSchema>;

export const wireCerebrasListOutputSchema = z.object({
  object: z.string().nullish(),
  data: z.array(_wireCerebrasModelSchema).nullish(),
});
