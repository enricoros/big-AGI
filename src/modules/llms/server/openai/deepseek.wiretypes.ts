import { z } from 'zod';


// [Deepseek AI] Models List API - Response

export const wireDeepseekAIListOutputSchema = z.array(z.object({
  id: z.string(),
  object: z.literal('model'),
  owned_by: z.string(),
}));

