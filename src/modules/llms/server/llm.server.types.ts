import { z } from 'zod';
import { LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '../store-llms';


// Model Description: a superset of LLM model descriptors

const pricingSchema = z.object({
  cpmPrompt: z.number().optional(), // Cost per thousand prompt tokens
  cpmCompletion: z.number().optional(), // Cost per thousand completion tokens
});

// const rateLimitsSchema = z.object({
//   reqPerMinute: z.number().optional(),
// });

const modelDescriptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  created: z.number().optional(),
  updated: z.number().optional(),
  description: z.string(),
  contextWindow: z.number().nullable(),
  maxCompletionTokens: z.number().optional(),
  pricing: pricingSchema.optional(),
  // rateLimits: rateLimitsSchema.optional(),
  trainingDataCutoff: z.string().optional(),
  interfaces: z.array(z.enum([LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Complete, LLM_IF_OAI_Vision])),
  hidden: z.boolean().optional(),
});

// this is also used by the Client
export type ModelDescriptionSchema = z.infer<typeof modelDescriptionSchema>;

export const llmsListModelsOutputSchema = z.object({
  models: z.array(modelDescriptionSchema),
});


// (non-streaming) Chat Generation Output

export const llmsChatGenerateOutputSchema = z.object({
  role: z.enum(['assistant', 'system', 'user']),
  content: z.string(),
  finish_reason: z.union([z.enum(['stop', 'length']), z.null()]),
});

export const llmsChatGenerateWithFunctionsOutputSchema = z.union([
  llmsChatGenerateOutputSchema,
  z.object({
    function_name: z.string(),
    function_arguments: z.record(z.any()),
  }),
]);