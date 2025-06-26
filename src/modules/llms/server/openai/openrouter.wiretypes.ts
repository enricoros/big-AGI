import * as z from 'zod/v4';


export const wireOpenrouterModelsListOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  // NOTE: for 'openrouter/auto', this is:  {
  //   "prompt": "-1",
  //   "completion": "-1"
  // }
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
    image: z.string().optional(),
    request: z.string().optional(),
  }),
  context_length: z.number(),
  architecture: z.object({
    modality: z.string(), // z.enum(['text', 'multimodal', 'text+image->text]),
    tokenizer: z.string(), // e.g. 'Mistral', 'Claude'
    instruct_type: z.string().nullable(),
  }),
  top_provider: z.object({
    max_completion_tokens: z.number().nullable(),
    is_moderated: z.boolean(), // false means that the user will need to do moderation, and likely this has lower latency
  }),

  // when logged in
  per_request_limits: z.object({
    prompt_tokens: z.string(),
    completion_tokens: z.string(),
  }).nullable(), // null on 'openrouter/auto'
});