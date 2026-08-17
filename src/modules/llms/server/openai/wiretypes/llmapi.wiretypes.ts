import * as z from 'zod/v4';


// [LLMAPI, 2026-08-17] NOTE: all the following mappings are based on today's https://api.llmapi.ai/v1/models (389 entries).
// The catalog drifts fast and a single required-but-missing field fails the whole list, which zeroes the vendor: the
// 2026-02-25 shape parsed 0 of 389 today, because 'json_output'/'structured_outputs' moved down into providers[] and
// 'pricing.image'/'pricing.request' became rare (7 and 2 of 389). So: only the fields the mapper structurally needs
// are required - everything read opportunistically is nullish.
const _wireLlmApiModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  // aliases: z.array(z.string()).optional(),
  created: z.number(),
  description: z.string(),
  family: z.string().nullish(),       // vendor/modality bucket ('openai', 'anthropic', 'video', 'stt', ...) - drives the non-chat filter
  released_at: z.string().nullish(),  // upstream release date 'YYYY-MM-DD' (386 of 389) - our pubDate source
  // kind: z.string().nullish(),      // 'chat'|'video'|'image'|'embedding' on 166 of 389 - adds nothing over the modality+family filter
  // default_reasoning_level: z.string().nullish(),

  architecture: z.object({
    input_modalities: z.array(z.enum(['text', 'image', 'audio', 'video']).or(z.string())),
    output_modalities: z.array(z.enum(['text', 'image', 'audio', 'video', 'embedding']).or(z.string())),
    // tokenizer: z.string(),
  }),

  // top_provider: z.object({ is_moderated: z.boolean() }),
  providers: z.array(z.object({
    providerId: z.string(),
    // modelName: z.string(),
    // pricing: z.object({ prompt: z.string(), completion: z.string() }).nullish(),
    streaming: z.boolean(),
    vision: z.boolean(),
    // cancellation: z.boolean(),
    tools: z.boolean(),
    // parallelToolCalls: z.boolean(),
    reasoning: z.boolean(),
    // reasoningLevels: z.array(z.string()).nullish(), // per-provider copy of the top-level 'reasoning_levels'
    json_output: z.boolean(),
    structured_outputs: z.boolean(),
  })),

  // Aggregate pricing (dollar-per-token as strings, e.g. "0.000003", "3e-7", "0")
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
    image: z.string().nullish(),    // rare: 7 of 389
    request: z.string().nullish(),  // rare: 2 of 389
    // input_cache_read: z.string(),
    // input_cache_write: z.string(),
    // web_search: z.string(),
    // internal_reasoning: z.string(),
  }),

  context_length: z.number().nullish(), // absent on meta-models ('custom', 'auto') and on most non-chat models

  supported_parameters: z.array(z.enum([
    'effort',
    'frequency_penalty',
    'max_tokens',
    'presence_penalty',
    'reasoning',
    'reasoning_effort',
    'response_format',
    'temperature',
    'tool_choice',
    'tools',
    'top_p',
  ]).or(z.string())).nullish(), // null on the embedding rows

  // Per-model reasoning ladder, ordered low to high; empty when the model has no effort control.
  // Observed values are all members of the llmVndOaiEffort enum, but stay open: the consumer validates.
  reasoning_levels: z.array(z.enum([
    'none',
    'minimal',
    'low',
    'medium',
    'high',
    'xhigh',
    'max',
  ]).or(z.string())).nullish(),

  free: z.boolean(),

  // Deprecation lifecycle
  deprecated_at: z.string().nullish(),
  deactivated_at: z.string().nullish(),
});


export type WireLlmApiModel = z.infer<typeof _wireLlmApiModelSchema>;
export const wireLlmApiListOutputSchema = z.object({
  data: z.array(_wireLlmApiModelSchema),
});
