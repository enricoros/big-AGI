import { z } from 'zod';

import { DLLM, DModelSource } from './store-llms';
import { LLMOptionsOpenAI } from './openai/openai.vendor';

// these are constants used for model interfaces (chat, and function calls)
// they're here as a preview - will be used more broadly in the future
export const LLM_IF_OAI_Chat = 'oai-chat';
export const LLM_IF_OAI_Fn = 'oai-fn';
export const LLM_IF_OAI_Complete = 'oai-complete';


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

export function modelDescriptionToDLLM(model: ModelDescriptionSchema, source: DModelSource): DLLM<LLMOptionsOpenAI> {
  return {
    id: `${source.id}-${model.id}`,
    label: model.label,
    created: model.created || 0,
    updated: model.updated || 0,
    description: model.description,
    tags: [], // ['stream', 'chat'],
    contextTokens: model.contextWindow,
    hidden: !!model.hidden,
    sId: source.id,
    _source: source,
    options: {
      llmRef: model.id,
      llmTemperature: 0.5,
      llmResponseTokens: Math.round(model.contextWindow / 8),
    },
  };
}