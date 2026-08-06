import * as z from 'zod/v4';


// [LLMAPI, 2026-02-25] NOTE: all the following mappings are based from today's https://api.llmapi.ai/v1/models
const _wireLlmApiModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  // aliases: z.array(z.string()).optional(),
  created: z.number(),
  description: z.string(),
  // family: z.string(),

  architecture: z.object({
    input_modalities: z.array(z.enum(['text', 'image']).or(z.string())),   // future: 'audio', 'video', ...
    output_modalities: z.array(z.enum(['text', 'image']).or(z.string())),  // future: 'audio', ...
    // tokenizer: z.string(),
  }),

  // top_provider: z.object({ is_moderated: z.boolean() }),
  providers: z.array(z.object({
    providerId: z.string(),
    // modelName: z.string(),
    // pricing: z.object({ prompt: z.string(), completion: z.string(), image: z.string() }).optional(),
    streaming: z.boolean(),
    vision: z.boolean(),
    // cancellation: z.boolean(),
    tools: z.boolean(),
    // parallelToolCalls: z.boolean(),
    reasoning: z.boolean(),
    // reasoningLevels: z.unknown().nullable(),
  })),

  // Aggregate pricing (dollar-per-token as strings, e.g. "0.000003", "3e-7", "0")
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
    image: z.string(),
    request: z.string(),
    // input_cache_read: z.string(),
    // input_cache_write: z.string(),
    // web_search: z.string(),
    // internal_reasoning: z.string(),
  }),

  context_length: z.number().nullish(), // absent on meta-models ('custom', 'auto')

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
  ]).or(z.string())),

  json_output: z.boolean(),
  structured_outputs: z.boolean(),
  free: z.boolean(),

  // Deprecation lifecycle
  deprecated_at: z.string().nullish(),
  deactivated_at: z.string().nullish(),
});


export type WireLlmApiModel = z.infer<typeof _wireLlmApiModelSchema>;
export const wireLlmApiListOutputSchema = z.object({
  data: z.array(_wireLlmApiModelSchema),
});
