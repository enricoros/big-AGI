import { z } from 'zod';


// [Together AI] Models List API - Response

export const wireTogetherAIListOutputSchema = z.array(z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
}));

// export type WireTogetherAIListOutput = z.infer<typeof wireTogetherAIListOutputSchema>;
