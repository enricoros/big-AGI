import * as z from 'zod/v4';


// [Groq] Models List API - Response

export const wireGroqModelsListOutputSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
  owned_by: z.string(),
  // Groq-specific
  active: z.boolean(),
  context_window: z.number(),
  // public_apps: z.any(),
  max_completion_tokens: z.number(), // first found on 2025-04-16
});

