import { z } from 'zod';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '../../store-llms';

const pricingSchema = z.object({
  cpmPrompt: z.number().optional(), // Cost per thousand prompt tokens
  cpmCompletion: z.number().optional(), // Cost per thousand completion tokens
});

const modelDescriptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  created: z.number().optional(),
  updated: z.number().optional(),
  description: z.string(),
  contextWindow: z.number(),
  maxCompletionTokens: z.number().optional(),
  pricing: pricingSchema.optional(),
  interfaces: z.array(z.enum([LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Complete, LLM_IF_OAI_Vision])),
  hidden: z.boolean().optional(),
});
export type ModelDescriptionSchema = z.infer<typeof modelDescriptionSchema>;

export const listModelsOutputSchema = z.object({
  models: z.array(modelDescriptionSchema),
});
