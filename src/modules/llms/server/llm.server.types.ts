import { z } from 'zod';

import { LLMS_ALL_INTERFACES } from '~/common/stores/llms/llms.types';


export type ModelDescriptionSchema = z.infer<typeof ModelDescription_schema>;

// export namespace AixWire_API_ListModels {

/*
 * Note: this needs to be moved to the AixWire_API_ListModels namespace
 * HOWEVER if we did it now there will be some circular dependency issue
 */


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

// NOTE: (!) keep this in sync with DPricingChatGenerate (llms.pricing.ts)
const PricingChatGenerate_schema = z.object({
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
const ModelParameterSpec_schema = z.object({
  /**
   * Uncommon idiosyncratic parameters for this model
   * - we have only the 'extra' params here, as `llmRef`, `llmResponseTokens` and `llmTemperature` are common
   * - see `llms.parameters.ts` for the full list
   */
  paramId: z.enum([
    'llmTopP',
    'llmVndOaiReasoningEffort',  // vendor-specific
  ]),
  required: z.boolean().optional(),
  hidden: z.boolean().optional(),
  upstreamDefault: z.any().optional(),
});

export const ModelDescription_schema = z.object({
  id: z.string(),
  label: z.string(),
  created: z.number().optional(),
  updated: z.number().optional(),
  description: z.string(),
  contextWindow: z.number().nullable(),
  interfaces: z.array(z.enum(LLMS_ALL_INTERFACES)),
  parameterSpecs: z.array(ModelParameterSpec_schema).optional(),
  maxCompletionTokens: z.number().optional(),
  // rateLimits: rateLimitsSchema.optional(),
  trainingDataCutoff: z.string().optional(),
  benchmark: BenchmarksScores_schema.optional(),
  chatPrice: PricingChatGenerate_schema.optional(),
  hidden: z.boolean().optional(),
  // TODO: add inputTypes/Kinds..
});


/// ListModels Response

export const ListModelsResponse_schema = z.object({
  models: z.array(ModelDescription_schema),
});
