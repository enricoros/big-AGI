import * as z from 'zod/v4';


export const wireOpenrouterModelsListOutputSchema = z.object({
  id: z.string(),
  /**
   * Can be the underlying versioned of a symlink model.
   * Also if id='...:free' this is without it.
   */
  // canonical_slug: z.string(), // not useful to us
  // hugging_face_id: z.string().nullish(), // for models in HF
  name: z.string(),
  created: z.number().optional(),
  description: z.string(),
  // [OpenRouter, 2026-08-06] set on the 11 '~vendor/model-latest' router aliases: the model they point to
  alias_target: z.object({
    name: z.string(),
    slug: z.string(),
  }).nullish(),
  // NOTE: for 'openrouter/auto', this is:  {
  //   "prompt": "-1",
  //   "completion": "-1"
  // }
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
    image: z.string().optional(),
    audio: z.string().optional(),
    request: z.string().optional(),
    web_search: z.string().optional(),
    internal_reasoning: z.string().optional(),
    input_cache_read: z.string().optional(),
    input_cache_write: z.string().optional(),
    // [OpenRouter, 2026-08-06] long-context surcharge tiers, ascending by `min_prompt_tokens`; a tier
    // omitting a price field keeps the price of the tier below it
    // [OpenRouter, 2026-08-16] a second override shape appeared: time-of-day windows (`utc_start`/`utc_end`, no
    // `min_prompt_tokens`) on deepseek/deepseek-v4-pro(-0813) (off-peak discount) - it made the strict schema fail
    // and drop the model; tolerated here and ignored by the price folding (list price applies)
    overrides: z.array(z.object({
      min_prompt_tokens: z.number().optional(),
      utc_start: z.number().optional(),
      utc_end: z.number().optional(),
      prompt: z.string().optional(),
      completion: z.string().optional(),
      input_cache_read: z.string().optional(),
      input_cache_write: z.string().optional(),
    })).optional(),
  }),
  context_length: z.number(),
  architecture: z.object({
    modality: z.string(), // z.enum(['text', 'multimodal', 'text+image->text']),
    input_modalities: z.array(
      z.union([
        z.enum(['text', 'image', 'file', 'audio', 'video']),
        z.string(),
      ]),
    ),
    output_modalities: z.array(
      z.union([
        z.enum(['text', 'image', 'audio']),
        z.string(),
      ]),
    ),
    tokenizer: z.string(), // e.g. 'Mistral', 'Claude', 'GPT', 'Gemini'
    instruct_type: z.string().nullable(),
  }),
  top_provider: z.object({
    context_length: z.number().nullable(),
    max_completion_tokens: z.number().nullable(),
    // is_moderated: z.boolean(), // false means that the user will need to do moderation, and likely this has lower latency
  }),

  // when logged in
  per_request_limits: z.object({
    prompt_tokens: z.string(),
    completion_tokens: z.string(),
  }).nullable(), // null on 'openrouter/auto'

  // [OpenRouter, 2026-04-16] Supported API parameters for this model
  supported_parameters: z.array(z.union([
    z.enum([
      'frequency_penalty',
      'include_reasoning', // Reasoning 2
      'logit_bias',
      'logprobs',
      'max_completion_tokens',
      'max_tokens',
      'min_p',
      'parallel_tool_calls',
      'prediction', // predicted outputs (speculative decoding hint)
      'presence_penalty',
      'reasoning', // Reasoning
      'reasoning_effort', // Legacy (prefer 'reasoning')
      'repetition_penalty',
      'response_format',
      'seed',
      'stop',
      'structured_outputs', // Json
      'temperature',
      'tool_choice',
      'tools', // FC
      'top_a', // still tolerated - no longer surfaced by OR as of 2026-04-16
      'top_k',
      'top_logprobs',
      'top_p',
      'verbosity',
      'web_search_options', // all models have also fallback search
    ]),
    z.string(), // Allow other parameters not in the enum
  ])).optional(),

  // [OpenRouter, 2026-07-31] Per-model reasoning surface. Often present with `supported_efforts` null/absent (most GLM,
  // Kimi K2.x, Grok 4.20, DeepSeek V3.x), so an empty list means "no information", never "no efforts supported".
  reasoning: z.object({
    mandatory: z.boolean().nullish(), // true = reasoning cannot be disabled (rejects the 'off' request)
    default_enabled: z.boolean().nullish(),
    supported_efforts: z.array(z.string()).nullish(),
    default_effort: z.string().nullish(),
    supports_max_tokens: z.boolean().nullish(), // true = accepts reasoning.max_tokens (thinking budget) instead of/besides efforts
  }).nullish(),

  // not useful to us
  // default_parameters: z.object({
  //   temperature: z.number().nullish(),
  //   top_p: z.number().nullish(),
  //   frequency_penalty: z.number().nullish(),
  // }).nullish(),

});

// [OpenRouter] Image Generation API - https://openrouter.ai/docs/features/multimodal/image-generation
// - POST /api/v1/images: { model, prompt, n? } -> { created, data: [{ b64_json, media_type? }], usage? }

export type WireOpenRouterCreateImagesRequest = z.infer<typeof wireOpenRouterCreateImagesRequestSchema>;
export const wireOpenRouterCreateImagesRequestSchema = z.object({
  model: z.string(),
  prompt: z.string(),
  n: z.number().min(1).max(10).optional(),
});

export type WireOpenRouterCreateImagesResponse = z.infer<typeof wireOpenRouterCreateImagesResponseSchema>;
export const wireOpenRouterCreateImagesResponseSchema = z.object({
  created: z.number().optional(),
  data: z.array(z.object({
    b64_json: z.string(),
    media_type: z.string().optional(), // e.g. 'image/png' - may be absent even for JPEGs
    revised_prompt: z.string().optional(),
  })),
  usage: z.object({
    prompt_tokens: z.number().optional(),
    completion_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
  }).loose().optional(),
});
