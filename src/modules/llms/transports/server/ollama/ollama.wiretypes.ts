import { z } from 'zod';

export const wireOllamaGenerationSchema = z.object({
  model: z.string(),
  // created_at: z.string(), // commented because unused
  response: z.string(),
  done: z.boolean(),

  // only on the last message
  // context: z.array(z.number()),
  // total_duration: z.number(),
  // load_duration: z.number(),
  // eval_duration: z.number(),
  // prompt_eval_count: z.number(),
  // eval_count: z.number(),
});
