import * as z from 'zod/v4';

import { LLMS_ALL_INTERFACES } from '~/common/stores/llms/llms.types';


export type RequestAccessValues = { headers: HeadersInit; url: string; };

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
   * User-changeable parameters for this LLM.
   *
   * Uncommon idiosyncratic parameters for this model
   * - we have only the 'extra' params here, as `llmRef`, `llmResponseTokens` and `llmTemperature` are common
   * - see `llms.parameters.ts` for the full list
   *
   * NOTE: (!) keep this in sync with `DModelParameterId` (llms.parameters.ts) which is also used in AixAPI_Model when making the request
   */
  paramId: z.enum([
    'llmTopP',
    'llmForceNoStream',
    // Anthropic
    'llmVndAnt1MContext',
    'llmVndAntEffort',
    'llmVndAntSkills',
    'llmVndAntThinkingBudget',
    'llmVndAntWebFetch',
    'llmVndAntWebSearch',
    // Gemini
    'llmVndGeminiAspectRatio',
    'llmVndGeminiCodeExecution',
    'llmVndGeminiComputerUse',
    'llmVndGeminiGoogleSearch',
    'llmVndGeminiImageSize',
    'llmVndGeminiMediaResolution',
    'llmVndGeminiShowThoughts',
    'llmVndGeminiThinkingBudget',
    'llmVndGeminiThinkingLevel',
    // 'llmVndGeminiUrlContext',
    // Moonshot
    'llmVndMoonshotWebSearch',
    // OpenAI
    'llmVndOaiReasoningEffort',
    'llmVndOaiReasoningEffort4',
    'llmVndOaiReasoningEffort52',
    'llmVndOaiReasoningEffort52Pro',
    'llmVndOaiRestoreMarkdown',
    'llmVndOaiVerbosity',
    'llmVndOaiWebSearchContext',
    'llmVndOaiWebSearchGeolocation',
    'llmVndOaiImageGeneration',
    // OpenRouter
    'llmVndOrtWebSearch',
    // Perplexity
    'llmVndPerplexityDateFilter',
    'llmVndPerplexitySearchMode',
    // xAI
    'llmVndXaiSearchMode',
    'llmVndXaiSearchSources',
    'llmVndXaiSearchDateFilter',
  ]),
  required: z.boolean().optional(),
  hidden: z.boolean().optional(),
  initialValue: z.number().or(z.string()).or(z.boolean()).nullable().optional(),
  // special params
  rangeOverride: z.tuple([z.number(), z.number()]).optional(), // [min, max]
});

export const ModelDescription_schema = z.object({
  id: z.string(),
  idVariant: z.string().optional(), // only used on the client by '_createDLLMFromModelDescription' to instantiate 'unique' copies of the same model
  label: z.string(),
  created: z.number().optional(),
  updated: z.number().optional(),
  description: z.string(),
  contextWindow: z.number().nullable(),
  interfaces: z.array(z.union([z.enum(LLMS_ALL_INTERFACES), z.string()])), // backward compatibility: to not Break client-side interface parsing on newer server
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
