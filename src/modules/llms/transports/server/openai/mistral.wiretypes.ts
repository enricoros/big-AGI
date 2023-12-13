import { z } from 'zod';


// [Mistral] Models List API - Response

export const wireMistralModelsListOutputSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number(),
  owned_by: z.string(),
  root: z.null().optional(),
  parent: z.null().optional(),
  // permission: z.array(wireMistralModelsListPermissionsSchema)
});

// export type WireMistralModelsListOutput = z.infer<typeof wireMistralModelsListOutputSchema>;

/*
const wireMistralModelsListPermissionsSchema = z.object({
  id: z.string(),
  object: z.literal('model_permission'),
  created: z.number(),
  allow_create_engine: z.boolean(),
  allow_sampling: z.boolean(),
  allow_logprobs: z.boolean(),
  allow_search_indices: z.boolean(),
  allow_view: z.boolean(),
  allow_fine_tuning: z.boolean(),
  organization: z.string(),
  group: z.null().optional(),
  is_blocking: z.boolean()
});
*/