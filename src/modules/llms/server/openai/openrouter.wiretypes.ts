import { z } from 'zod';


export const wireOpenrouterModelsListOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
    image: z.string(),
    request: z.string(),
  }),
  context_length: z.number(),
  architecture: z.object({
    modality: z.string(), // z.enum(['text', 'multimodal']),
    tokenizer: z.string(), // e.g. 'Mistral'
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