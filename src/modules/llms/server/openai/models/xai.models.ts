import * as z from 'zod/v4';

import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { OPENAI_API_PATHS, openAIAccess, OpenAIAccessSchema } from '../openai.access';
import { fromManualMapping, KnownModel, llmDevCheckModels_DEV, ManualMappings } from '../../models.mappings';


// configuration
const DEV_DEBUG_XAI_MODELS = (Release.TenantSlug as any) === 'staging' /* ALSO IN STAGING! */ || Release.IsNodeDevBuild;


// Known xAI Models - Manual Mappings
// List on: https://docs.x.ai/docs/models?cluster=us-east-1
// Verified: 2026-01-29

// Tiered pricing for Grok 4.1 Fast models (both reasoning and non-reasoning)
const PRICE_41 = {
  input: [{ upTo: 128000, price: 0.2 }, { upTo: null, price: 0.4 }],
  output: [{ upTo: 128000, price: 0.5 }, { upTo: null, price: 1.0 }],
  cache: { cType: 'oai-ac' as const, read: 0.05 },
};

// Tiered pricing for Grok 4.0 Fast models (both reasoning and non-reasoning)
const PRICE_40 = {
  input: [{ upTo: 128000, price: 0.2 }, { upTo: null, price: 0.4 }],
  output: [{ upTo: 128000, price: 0.5 }, { upTo: null, price: 1.0 }],
  cache: { cType: 'oai-ac' as const, read: 0.05 },
};

// Interfaces: ALL XAI MODELS use the OpenAI Responses API (XAI dialect)
// we don't add LLM_IF_OAI_Responses explicitly here, as the code fully treats XAI/XAI Models with responses

const XAI_IF: ModelDescriptionSchema['interfaces'] = [
  LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json,
] as const;

const XAI_IF_Vision: ModelDescriptionSchema['interfaces'] = [
  ...XAI_IF, LLM_IF_OAI_Vision,
] as const;


// Parameter specs for xAI models

const XAI_PAR: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndXaiCodeExecution' },
  { paramId: 'llmVndXaiSearchInterval' },
  { paramId: 'llmVndXaiWebSearch' },
  { paramId: 'llmVndXaiXSearch' },
  // { paramId: 'llmVndXaiXSearchHandles' }, // too early
] as const;

// Reasoning variants have no configuration for it - only grok-3-mini had it, as of 2026-01-22:
// - https://docs.x.ai/docs/guides/reasoning
// hence it's the same parameters
const XAI_PAR_Reasoning = XAI_PAR;

// Pre-Grok 4 models do NOT support server-side tools (web_search, x_search, code_interpreter)
const XAI_IF_Pre4: ModelDescriptionSchema['interfaces'] = [
  LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json,
] as const;

const XAI_IF_Pre4_Vision: ModelDescriptionSchema['interfaces'] = [
  ...XAI_IF_Pre4, LLM_IF_OAI_Vision,
] as const;

const XAI_PAR_Pre4: ModelDescriptionSchema['parameterSpecs'] = [] as const;


const _knownXAIChatModels: ManualMappings = [

  // Grok 4.1
  {
    idPrefix: 'grok-4-1-fast-reasoning',
    label: 'Grok 4.1 Fast Reasoning',
    description: 'Next generation frontier multimodal model optimized for high-performance agentic tool calling with a 2M token context window. Trained specifically for real-world enterprise use cases with exceptional performance on agentic workflows.',
    contextWindow: 2000000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: XAI_PAR_Reasoning,
    chatPrice: PRICE_41,
    benchmark: { cbaElo: 1430 }, // grok-4-1-fast-reasoning
  },
  {
    idPrefix: 'grok-4-1-fast-non-reasoning',
    label: 'Grok 4.1 Fast', // 'Grok 4.1 Fast Non-Reasoning'
    description: 'Next generation frontier multimodal model optimized for high-performance agentic tool calling with a 2M token context window. Non-reasoning variant for instant responses.',
    contextWindow: 2000000,
    maxCompletionTokens: undefined,
    interfaces: XAI_IF_Vision,
    parameterSpecs: XAI_PAR,
    chatPrice: PRICE_41,
    benchmark: { cbaElo: 1466 }, // grok-4.1
  },

  // Grok 4
  {
    hidden: true, // yield to 4.1
    idPrefix: 'grok-4-fast-reasoning',
    label: 'Grok 4 Fast Reasoning',
    description: 'Cost-efficient reasoning model with a 2M token context window. Optimized for fast reasoning in agentic workflows. 98% cost reduction vs Grok 4 with comparable performance.',
    contextWindow: 2000000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: XAI_PAR_Reasoning,
    chatPrice: PRICE_40,
    benchmark: { cbaElo: 1404 }, // grok-4-fast-reasoning
  },
  {
    hidden: true, // yield to 4.1
    idPrefix: 'grok-4-fast-non-reasoning',
    label: 'Grok 4 Fast', // 'Grok 4 Fast Non-Reasoning'
    description: 'Cost-efficient non-reasoning model with a 2M token context window. Same weights as grok-4-fast-reasoning but constrained by non-reasoning system prompt for quick responses.',
    contextWindow: 2000000,
    maxCompletionTokens: undefined,
    interfaces: XAI_IF_Vision,
    parameterSpecs: XAI_PAR,
    chatPrice: PRICE_40,
  },
  {
    idPrefix: 'grok-4-0709',
    label: 'Grok 4 (0709)',
    description: 'xAI\'s most advanced model, offering state-of-the-art reasoning and problem-solving capabilities over a massive 256k context window. Supports text and image inputs.',
    contextWindow: 256000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: XAI_PAR_Reasoning,
    chatPrice: { input: 3, output: 15, cache: { cType: 'oai-ac', read: 0.75 } },
    benchmark: { cbaElo: 1410 }, // grok-4-0709
  },

  // Grok 3 (Pre-Grok 4: no server-side tools)
  {
    idPrefix: 'grok-3',
    label: 'Grok 3',
    description: 'xAI flagship model that excels at enterprise use cases like data extraction, coding, and text summarization. Possesses deep domain knowledge in finance, healthcare, law, and science.',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: XAI_IF_Pre4,
    parameterSpecs: XAI_PAR_Pre4,
    chatPrice: { input: 3, output: 15, cache: { cType: 'oai-ac', read: 0.75 } },
    benchmark: { cbaElo: 1411 }, // grok-3-preview-02-24
  },
  {
    idPrefix: 'grok-3-mini',
    label: 'Grok 3 Mini',
    description: 'A lightweight model that is fast and smart for logic-based tasks. Supports function calling and structured outputs.',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Pre4, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] },
      ...XAI_PAR_Pre4,
    ],
    chatPrice: { input: 0.3, output: 0.5, cache: { cType: 'oai-ac', read: 0.075 } },
    benchmark: { cbaElo: 1357 }, // grok-3-mini-beta
  },

  // Grok Code (Pre-Grok 4: no server-side tools)
  {
    idPrefix: 'grok-code-fast-1',
    label: 'Grok Code Fast 1',
    description: 'Specialized reasoning model for agentic coding workflows. Fast, economical, and optimized for code generation, debugging, and software development tasks.',
    contextWindow: 256000,
    maxCompletionTokens: undefined,
    interfaces: [...XAI_IF_Pre4, LLM_IF_OAI_Reasoning],
    parameterSpecs: XAI_PAR_Pre4,
    chatPrice: { input: 0.2, output: 1.5, cache: { cType: 'oai-ac', read: 0.02 } },
    benchmark: { cbaElo: 1380 }, // Estimated for coding-specialized model
  },

  // Grok 2 (Pre-Grok 4: no server-side tools)
  {
    idPrefix: 'grok-2-vision-1212',
    label: 'Grok 2 Vision (1212)',
    description: 'xAI model grok-2-vision-1212 with image and text input capabilities. Supports text generation with a 32,768 token context window.',
    contextWindow: 32768,
    maxCompletionTokens: undefined,
    interfaces: XAI_IF_Pre4_Vision,
    parameterSpecs: XAI_PAR_Pre4,
    chatPrice: { input: 2, output: 10 },
    // no benchmark: keep this out
  },

] as const;


// -- xAI Model Descriptions --

function xaiValidateModelDefs_DEV(availableModels: z.infer<typeof wireXAIModelsListSchema>['models']): void {
  if (DEV_DEBUG_XAI_MODELS) {
    llmDevCheckModels_DEV('xAI', availableModels.map(m => m.id), _knownXAIChatModels.map(m => m.idPrefix));
  }
}

export async function xaiFetchModelDescriptions(access: OpenAIAccessSchema): Promise<ModelDescriptionSchema[]> {

  // List models
  const { headers, url } = openAIAccess(access, null, OPENAI_API_PATHS.xaiLanguageModels);
  const modelsResponse = await fetchJsonOrTRPCThrow({ url, headers, name: 'xAI' });

  const xaiModels = wireXAIModelsListSchema.parse(modelsResponse);

  // DEV: validate model definitions
  xaiValidateModelDefs_DEV(xaiModels.models);

  return xaiModels.models.reduce((acc, xm) => {

    // Fallback for unknown models
    const unknownModelFallback: KnownModel = {
      idPrefix: xm.id,
      label: _xaiFormatNewModelLabel(xm.id),
      description: `xAI model ${xm.id}`,
      contextWindow: 256000, // random picked on 2026-01-22
      interfaces: [
        ...XAI_IF,
        ...(xm.input_modalities?.includes('image') ? [LLM_IF_OAI_Vision] : []),
      ],
      parameterSpecs: XAI_PAR,
      ...(xm.prompt_text_token_price != null && xm.completion_text_token_price != null && {
        chatPrice: {
          input: xm.prompt_text_token_price / 10000, // Scaling factor applied as per API data
          output: xm.completion_text_token_price / 10000,
        },
      }),
    };

    // xAI model description
    const modelDescription = fromManualMapping(_knownXAIChatModels, xm.id, xm.created, undefined, unknownModelFallback);

    // quick validation for non-text modalities
    const knownInputModalities = ['text', 'image'];
    const knownOutputModalities = ['text'];
    const nonTextInput = xm.input_modalities?.filter(m => !knownInputModalities.includes(m)) || [];
    const nonTextOutput = xm.output_modalities?.filter(m => !knownOutputModalities.includes(m)) || [];
    if (nonTextInput.length > 0 || nonTextOutput.length > 0) {
      console.warn(`[xAI Model Check] Model '${xm.id}' has non-text modalities. Input: [${nonTextInput.join(', ')}], Output: [${nonTextOutput.join(', ')}]`);
      modelDescription.label += ' 🧩';
      let modalityDetails = '';
      if (nonTextInput.length > 0) modalityDetails += ` Input: ${nonTextInput.join(', ')}.`;
      if (nonTextOutput.length > 0) modalityDetails += ` Output: ${nonTextOutput.join(', ')}.`;
      modelDescription.description += ` Supports additional modalities.${modalityDetails}`;
    }

    acc.push(modelDescription);

    // NOTE: disabled, as this is not useful
    // if there are aliases, add them as 'symlinked' models
    // if (xm.aliases?.length) {
    //   xm.aliases.forEach((alias) => {
    //     const aliasedModel = fromManualMapping([{
    //       idPrefix: alias,
    //       label: alias,
    //       symLink: xm.id,
    //       description: `xAI model ${alias}`,
    //       contextWindow: 16384,
    //       interfaces: unknownModelFallback.interfaces,
    //     }], alias, xm.created, xm.updated, unknownModelFallback);
    //     acc.push(aliasedModel);
    //   });
    // }

    return acc;
  }, [] as ModelDescriptionSchema[]);
}

// manual sort order - your desired order
const _xaiIdStartsWithOrder = [
  'grok-4-1-fast-reasoning',
  'grok-4-1-fast-non-reasoning',
  'grok-code-fast-1',
  'grok-4-fast-reasoning',
  'grok-4-fast-non-reasoning',
  'grok-4-0709',
  'grok-3-fast',
  'grok-3',
  'grok-3-mini-fast',
  'grok-3-mini',
  'grok-2-vision-1212',
  'grok-2-1212',
  'grok-vision-beta',
  'grok-beta',
];

export function xaiModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // First try exact matches with the order array
  const aExact = _xaiIdStartsWithOrder.indexOf(a.id);
  const bExact = _xaiIdStartsWithOrder.indexOf(b.id);

  // If both have exact matches, use those positions
  if (aExact !== -1 && bExact !== -1)
    return aExact - bExact;

  // If only one has exact match, prioritize it
  if (aExact !== -1) return -1;
  if (bExact !== -1) return 1;

  // Fall back to prefix matching for unknown models
  const aStartsWith = _xaiIdStartsWithOrder.findIndex((prefix) => a.id.startsWith(prefix));
  const bStartsWith = _xaiIdStartsWithOrder.findIndex((prefix) => b.id.startsWith(prefix));

  if (aStartsWith !== bStartsWith)
    return aStartsWith - bStartsWith;

  return b.label.localeCompare(a.label);
}

function _xaiFormatNewModelLabel(modelId: string): string {
  if (!modelId) return 'Unknown Model';

  const parts = modelId.split('-');
  if (parts.length)
    parts[0] = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);

  let hasBeta = false;
  const cleanedParts = parts.filter(part => {
    if (part.toLowerCase() === 'beta') {
      hasBeta = true;
      return false;
    }
    return true;
  });

  return '[new] ' + cleanedParts.join(' ') + (hasBeta ? ' (beta)' : '');
}


export const wireXAIModelSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  owned_by: z.literal('xai').or(z.string()),

  // timestamps
  created: z.number().optional(),
  updated: z.number().optional(),
  version: z.string().optional(),

  // modalities
  input_modalities: z.array(z.string()),    // 'text', 'image', etc.
  output_modalities: z.array(z.string()),   // 'text', 'image', etc.

  // pricing - FIXME: SCALE UNKNOWN for now
  prompt_text_token_price: z.number().optional(),
  prompt_image_token_price: z.number().optional(),
  completion_text_token_price: z.number().optional(),
  cached_prompt_text_token_price: z.number().optional(),

  // System information
  fingerprint: z.string().optional(),

  // Aliases for models
  aliases: z.array(z.string()).optional(),
});

export const wireXAIModelsListSchema = z.object({
  models: z.array(wireXAIModelSchema),
});
