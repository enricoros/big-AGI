import { z } from 'zod';


// @upstream: https://docs.openpipe.ai/api-reference/get-listModels

const openpipeSchema = z.object({
  baseModel: z.string(),
  status: z.enum(['PENDING', 'TRAINING', 'DEPLOYED', 'ERROR', 'DEPRECATED']),
  datasetId: z.string(),
  errorMessage: z.string().nullable(),
});


export const wireOpenPipeModelOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  created: z.string(),  // ISO string
  updated: z.string(),  // ISO string
  openpipe: openpipeSchema,
  contextWindow: z.number(),
  maxCompletionTokens: z.number(),
  capabilities: z.array(z.enum(['chat', 'tools', 'json'])),
  pricing: z.object({
    chatIn: z.number(),
    chatOut: z.number(),
  }).optional(),
});