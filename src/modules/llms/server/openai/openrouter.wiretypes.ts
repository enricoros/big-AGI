import { z } from 'zod';


export const wireOpenrouterModelsListOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
  }),
  context_length: z.number(),
  architecture: z.object({
    tokenizer: z.string(),
    instruct_type: z.string().nullable(),
  }),
  top_provider: z.object({
    max_completion_tokens: z.number().nullable(),
  }),

  // when logged in
  per_request_limits: z.object({
    prompt_tokens: z.string(),
    completion_tokens: z.string(),
  }).nullable(), // null on 'openrouter/auto'
});