import { z } from 'zod';


// [Fireworks AI] Models List API - Response

export const wireFireworksAIListOutputSchema = z.array(z.object({

  id: z.string(),
  object: z.literal('model'),
  owned_by: z.union([
    z.literal('fireworks'),
    z.literal('yi-01-ai'),
    z.string(),
  ]),
  created: z.number(),
  kind: z.union([
    z.literal('HF_BASE_MODEL'),
    z.literal('HF_PEFT_ADDON'),
    z.literal('FLUMINA_BASE_MODEL'),
    z.string(),
  ]).optional(),
  // these seem to be there all the time, but just in case make them optional
  supports_chat: z.boolean().optional(),
  supports_image_input: z.boolean().optional(),
  supports_tools: z.boolean().optional(),
  // Not all models have this, so make it optional
  context_length: z.number().optional(),
}));
