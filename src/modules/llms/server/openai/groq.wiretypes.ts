import { z } from 'zod';


// [Groq] Models List API - Response

export const wireGroqModelsListOutputSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
  owned_by: z.string(),
  active: z.boolean(),
});

