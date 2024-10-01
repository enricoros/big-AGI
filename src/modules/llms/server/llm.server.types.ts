import { z } from 'zod';

import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Complete, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Realtime, LLM_IF_OAI_Vision, LLM_IF_SPECIAL_OAI_O1Preview } from '~/common/stores/llms/llms.types';


export type ModelDescriptionSchema = z.infer<typeof ModelDescription_schema>;

// export namespace AixWire_API_ListModels {

/*
 * Note: this needs to be moved to the AixWire_API_ListModels namespace
 * HOWEVER if we did it now there will be some circular dependency issue
 */

/// Interfaces

// TODO: just remove this, and move to a capabilities array (I/O/...)
// FIXME: keep this in sync with the client side on llms.types.ts
const Interface_enum = z.enum([
  LLM_IF_OAI_Chat,              // OpenAI Chat
  LLM_IF_OAI_Fn,                // JSON mode?
  LLM_IF_OAI_Vision,            // Vision mode?
  LLM_IF_OAI_Json,              // Function calling
  LLM_IF_OAI_Complete,          // Complete mode
  LLM_IF_ANT_PromptCaching,     // Anthropic Prompt caching
  LLM_IF_SPECIAL_OAI_O1Preview, // Special OAI O1 Preview
  LLM_IF_OAI_PromptCaching,     // OpenAI Prompt caching
  LLM_IF_OAI_Realtime,         // OpenAI Realtime
]);


/// Benchmark

const BenchmarksScores_schema = z.object({
  cbaElo: z.number().optional(),
  cbaMmlu: z.number().optional(),
  // heCode: z.number().optional(), // HumanEval, code, 0-shot
  // vqaMmmu: z.number().optional(), // Visual Question Answering, MMMU, 0-shot
});


/// Pricing

const PricePerMToken_schema = z.number().or(z.literal('free'));

const PriceUpTo_schema = z.object({
  upTo: z.number().nullable(),
  price: PricePerMToken_schema,
});

const TieredPricing_schema = z.union([
  PricePerMToken_schema,
  z.array(PriceUpTo_schema),
]);

// NOTE: (!) keep this in sync with DChatGeneratePricing (llms.pricing.ts)
const ChatGeneratePricing_schema = z.object({
  input: TieredPricing_schema.optional(),
  output: TieredPricing_schema.optional(),
  // Future: Perplexity has a cost per request, consider this for future additions
  // perRequest: z.number().optional(), // New field for fixed per-request pricing
  cache: z.discriminatedUnion('cType', [
    z.object({
      cType: z.literal('ant-bp'), // [Anthropic] Breakpoint-based caching
      read: TieredPricing_schema,
      write: TieredPricing_schema,
      duration: z.number(),
    }),
    z.object({
      cType: z.literal('oai-ac'), // [OpenAI] Automatic Caching
      read: TieredPricing_schema,
      // write: TieredPricing_schema, // Not needed, as it's the same as input cost, i.e. = 0
    }),
  ]).optional(),
  // Not for the server-side, computed on the client only
  // _isFree: z.boolean().optional(),
});


/// Model Description (out)

export const ModelDescription_schema = z.object({
  id: z.string(),
  label: z.string(),
  created: z.number().optional(),
  updated: z.number().optional(),
  description: z.string(),
  contextWindow: z.number().nullable(),
  interfaces: z.array(Interface_enum),
  maxCompletionTokens: z.number().optional(),
  // rateLimits: rateLimitsSchema.optional(),
  trainingDataCutoff: z.string().optional(),
  benchmark: BenchmarksScores_schema.optional(),
  chatPrice: ChatGeneratePricing_schema.optional(),
  hidden: z.boolean().optional(),
  // TODO: add inputTypes/Kinds..
});


/// ListModels Response

export const ListModelsResponse_schema = z.object({
  models: z.array(ModelDescription_schema),
});
