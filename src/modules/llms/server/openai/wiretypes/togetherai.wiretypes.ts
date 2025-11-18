import * as z from 'zod/v4';


// [Together AI] Models List API - Response

export const wireTogetherAIListOutputSchema = z.array(z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
  type: z.string(), // e.g., 'chat', 'language', 'image', 'embedding'
  running: z.boolean(),
  display_name: z.string(),

  organization: z.string().nullable().optional(),
  link: z.string().nullable().optional(),
  license: z.string().nullable().optional(),
  context_length: z.number().optional(),

  // Configuration object
  // config: z.object({
  //   chat_template: z.string().nullable(),
  //   stop: z.array(z.string()),
  //   bos_token: z.string().nullable(),
  //   eos_token: z.string().nullable(),
  // }).optional(),

  // Pricing information
  pricing: z.object({
    hourly: z.number(),
    input: z.number(),
    output: z.number(),
    base: z.number(),
    finetune: z.number(),
  }),
}));

// export type WireTogetherAIListOutput = z.infer<typeof wireTogetherAIListOutputSchema>;
