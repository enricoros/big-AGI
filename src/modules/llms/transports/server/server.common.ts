import { z } from 'zod';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn } from '../../store-llms';


const modelDescriptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  created: z.number().optional(),
  updated: z.number().optional(),
  description: z.string(),
  contextWindow: z.number(),
  interfaces: z.array(z.enum([LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Complete])),
  hidden: z.boolean().optional(),
});

export type ModelDescriptionSchema = z.infer<typeof modelDescriptionSchema>;

export const listModelsOutputSchema = z.object({
  models: z.array(modelDescriptionSchema),
});
