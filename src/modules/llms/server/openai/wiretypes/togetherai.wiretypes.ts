import * as z from 'zod/v4';


// [Together AI] Models List API - Response
// One schema parses the whole array: a field missing on any row (e.g. an image or video model) would fail the entire
// listing, so only fields the parser reads are declared, and those with a fallback are optional.

export const wireTogetherAIListOutputSchema = z.array(z.object({
  id: z.string(),
  created: z.number(),
  type: z.string().nullish(), // e.g., 'chat', 'language', 'image', 'embedding'
  display_name: z.string().optional(),

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
    input: z.number().optional(),
    output: z.number().optional(),
    cached_input: z.number().optional(),
  }).optional(),
}));

// export type WireTogetherAIListOutput = z.infer<typeof wireTogetherAIListOutputSchema>;
