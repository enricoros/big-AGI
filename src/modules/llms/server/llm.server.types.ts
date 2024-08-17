import { z } from 'zod';

import { AixWire_API_ListModels } from '~/modules/aix/server/api/aix.wiretypes';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision } from '~/common/stores/llms/dllm.types';


// Model Description: a superset of LLM model descriptors

const benchmarkSchema = z.object({
  cbaElo: z.number().optional(),
  cbaMmlu: z.number().optional(),
  // heCode: z.number().optional(), // HumanEval, code, 0-shot
  // vqaMmmu: z.number().optional(), // Visual Question Answering, MMMU, 0-shot
});

// const rateLimitsSchema = z.object({
//   reqPerMinute: z.number().optional(),
// });

const interfaceSchema = z.enum([LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Complete, LLM_IF_OAI_Vision, LLM_IF_OAI_Json]);

// NOTE: update the `fromManualMapping` function if you add new fields
const modelDescriptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  created: z.number().optional(),
  updated: z.number().optional(),
  description: z.string(),
  contextWindow: z.number().nullable(),
  interfaces: z.array(interfaceSchema),
  maxCompletionTokens: z.number().optional(),
  // rateLimits: rateLimitsSchema.optional(),
  trainingDataCutoff: z.string().optional(),
  benchmark: benchmarkSchema.optional(),
  chatPrice: AixWire_API_ListModels.PriceChatGenerate_schema.optional(),
  hidden: z.boolean().optional(),
  // TODO: add inputTypes/Kinds..
});

// this is also used by the Client
export type ModelDescriptionSchema = z.infer<typeof modelDescriptionSchema>;

export const llmsListModelsOutputSchema = z.object({
  models: z.array(modelDescriptionSchema),
});


// chat context

export const llmsGenerateContextSchema = z.object({
  method: z.literal('chat-generate'),
  name: z.enum(['chat-ai-title', 'chat-ai-summarize', 'chat-followup-diagram', 'chat-followup-htmlui', 'chat-react-turn', 'draw-expand-prompt']),
  ref: z.string(),
});
export type GenerateContextNameSchema = z.infer<typeof llmsGenerateContextSchema>['name'];

export const llmsStreamingContextSchema = z.object({
  method: z.literal('chat-stream'),
  name: z.enum(['conversation', 'ai-diagram', 'ai-flattener', 'call', 'beam-scatter', 'beam-gather', 'persona-extract']),
  ref: z.string(),
});
export type StreamingContextNameSchema = z.infer<typeof llmsStreamingContextSchema>['name'];


// (non-streaming) Chat Generation Output

export const llmsChatGenerateOutputSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string().nullable(),
  finish_reason: z.enum(['stop', 'length']).nullable(),
});

export const llmsChatGenerateWithFunctionsOutputSchema = z.union([
  llmsChatGenerateOutputSchema,
  z.object({
    function_name: z.string(),
    function_arguments: z.record(z.any()),
  }),
]);