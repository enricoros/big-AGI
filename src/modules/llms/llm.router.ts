import { z } from 'zod';

// these are constants used for model interfaces (chat, and function calls)
// they're here as a preview - will be used more broadly in the future
export const LLM_IF_OAI_Chat = 'oai-chat';
export const LLM_IF_OAI_Fn = 'oai-fn';


const modelDescriptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  created: z.number().optional(),
  updated: z.number().optional(),
  description: z.string(),
  contextWindow: z.number(),
  interfaces: z.array(z.enum([LLM_IF_OAI_Chat, LLM_IF_OAI_Fn])),
  hidden: z.boolean().optional(),
});

export type ModelDescriptionSchema = z.infer<typeof modelDescriptionSchema>;

export const listModelsOutputSchema = z.object({
  models: z.array(modelDescriptionSchema),
});