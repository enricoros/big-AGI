import * as z from 'zod/v4';

import { fetchJsonOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, KnownModel, ManualMappings } from '../../models.mappings';
import { openAIAccess, OpenAIAccessSchema } from '../openai.router';


// Known xAI Models - Manual Mappings
// List on: https://docs.x.ai/docs/models?cluster=us-east-1
// Verified: 2025-10-28
const _knownXAIChatModels: ManualMappings = [

  // Grok 4
  {
    idPrefix: 'grok-4-fast-reasoning',
    label: 'Grok 4 Fast Reasoning',
    description: 'Cost-efficient reasoning model with a 2M token context window. Optimized for fast reasoning in agentic workflows. 98% cost reduction vs Grok 4 with comparable performance.',
    contextWindow: 2000000,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision, LLM_IF_Tools_WebSearch, LLM_IF_OAI_Reasoning],
    parameterSpecs: [{ paramId: 'llmVndXaiSearchMode' }, { paramId: 'llmVndXaiSearchSources' }, { paramId: 'llmVndXaiSearchDateFilter' }],
    chatPrice: { input: 0.2, output: 0.5, cache: { cType: 'oai-ac', read: 0.05 } }, // Price increases for >128K tokens: input $0.40, output $1.00
    benchmark: { cbaElo: 1420 }, // Similar to grok-4-0709, slight adjustment for cost model
  },
  {
    idPrefix: 'grok-4-fast-non-reasoning',
    label: 'Grok 4 Fast', // 'Grok 4 Fast Non-Reasoning'
    description: 'Cost-efficient non-reasoning model with a 2M token context window. Same weights as grok-4-fast-reasoning but constrained by non-reasoning system prompt for quick responses.',
    contextWindow: 2000000,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision, LLM_IF_Tools_WebSearch],
    parameterSpecs: [{ paramId: 'llmVndXaiSearchMode' }, { paramId: 'llmVndXaiSearchSources' }, { paramId: 'llmVndXaiSearchDateFilter' }],
    chatPrice: { input: 0.2, output: 0.5, cache: { cType: 'oai-ac', read: 0.05 } }, // Price increases for >128K tokens: input $0.40, output $1.00
    benchmark: { cbaElo: 1420 - 2 }, // slightly lower than reasoning variant
  },
  {
    idPrefix: 'grok-4-0709',
    label: 'Grok 4 (0709)',
    description: 'xAI\'s most advanced model, offering state-of-the-art reasoning and problem-solving capabilities over a massive 256k context window. Supports text and image inputs.',
    contextWindow: 256000,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision, LLM_IF_Tools_WebSearch, LLM_IF_OAI_Reasoning],
    parameterSpecs: [{ paramId: 'llmVndXaiSearchMode' }, { paramId: 'llmVndXaiSearchSources' }, { paramId: 'llmVndXaiSearchDateFilter' }],
    chatPrice: { input: 3, output: 15, cache: { cType: 'oai-ac', read: 0.75 } },
    benchmark: { cbaElo: 1415 + 6 }, // grok-4-0709 (+6 to stay on top of the fast)
  },

  // Grok 3
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'grok-3-fast',
    label: 'Grok 3 Fast',
    description: 'Faster version of the xAI flagship model with identical response quality but significantly reduced latency. Ideal for latency-sensitive applications. (Not available as of October 2025)',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_Tools_WebSearch],
    parameterSpecs: [{ paramId: 'llmVndXaiSearchMode' }, { paramId: 'llmVndXaiSearchSources' }, { paramId: 'llmVndXaiSearchDateFilter' }],
    chatPrice: { input: 5, output: 25, cache: { cType: 'oai-ac', read: 1.25 } },
    benchmark: { cbaElo: 1408 }, // grok-3-fast (slight adjustment for cost model)
  },
  {
    idPrefix: 'grok-3',
    label: 'Grok 3',
    description: 'xAI flagship model that excels at enterprise use cases like data extraction, coding, and text summarization. Possesses deep domain knowledge in finance, healthcare, law, and science.',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_Tools_WebSearch],
    parameterSpecs: [{ paramId: 'llmVndXaiSearchMode' }, { paramId: 'llmVndXaiSearchSources' }, { paramId: 'llmVndXaiSearchDateFilter' }],
    chatPrice: { input: 3, output: 15, cache: { cType: 'oai-ac', read: 0.75 } },
    benchmark: { cbaElo: 1409 }, // grok-3-preview-02-24
  },
  {
    idPrefix: 'grok-3-mini',
    label: 'Grok 3 Mini',
    description: 'A lightweight model that is fast and smart for logic-based tasks. Supports function calling and structured outputs.',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_Tools_WebSearch, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort' },
      { paramId: 'llmVndXaiSearchMode' }, { paramId: 'llmVndXaiSearchSources' }, { paramId: 'llmVndXaiSearchDateFilter' },
    ],
    chatPrice: { input: 0.3, output: 0.5, cache: { cType: 'oai-ac', read: 0.075 } },
    benchmark: { cbaElo: 1358 }, // grok-3-mini-beta (updated from CSV)
  },
  {
    isLegacy: true,
    hidden: true,
    idPrefix: 'grok-3-mini-fast',
    label: 'Grok 3 Mini Fast',
    description: 'Faster version of the Grok 3 Mini model with identical response quality but significantly reduced latency. Ideal for latency-sensitive applications. (Not available as of October 2025)',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_Tools_WebSearch, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort' },
      { paramId: 'llmVndXaiSearchMode' }, { paramId: 'llmVndXaiSearchSources' }, { paramId: 'llmVndXaiSearchDateFilter' },
    ],
    chatPrice: { input: 0.6, output: 4, cache: { cType: 'oai-ac', read: 0.15 } },
    benchmark: { cbaElo: 1357 }, // grok-3-mini-fast (slight adjustment for cost model)
  },

  // Grok Code
  {
    idPrefix: 'grok-code-fast-1',
    label: 'Grok Code Fast 1',
    description: 'Specialized reasoning model for agentic coding workflows. Fast, economical, and optimized for code generation, debugging, and software development tasks.',
    contextWindow: 256000,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_Tools_WebSearch, LLM_IF_OAI_Reasoning],
    parameterSpecs: [{ paramId: 'llmVndXaiSearchMode' }, { paramId: 'llmVndXaiSearchSources' }, { paramId: 'llmVndXaiSearchDateFilter' }],
    chatPrice: { input: 0.2, output: 1.5, cache: { cType: 'oai-ac', read: 0.02 } },
    benchmark: { cbaElo: 1380 }, // Estimated for coding-specialized model
  },

  // Grok 2
  {
    idPrefix: 'grok-2-vision-1212',
    label: 'Grok 2 Vision (1212)',
    description: 'xAI model grok-2-vision-1212 with image and text input capabilities. Supports text generation with a 32,768 token context window.',
    contextWindow: 32768,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Json],
    chatPrice: { input: 2, output: 10 },
    // Fuzzy matched with "grok-2-2024-08-13" (1288) => wrong, but still we need a fallback
    benchmark: { cbaElo: 1288 },
  },
  {
    hidden: true, // IMAGE model - does not chat (!) - is actually not returned by the list endpoint, but we have it anyway for our records
    idPrefix: 'grok-2-image-1212',
    label: 'Grok 2 Image (1212)',
    description: 'xAI model for image generation. Each generated image costs $0.07.',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: [],
  },
  {
    hidden: true, // Not listed in official docs as of 2025-10-28
    idPrefix: 'grok-2-1212',
    label: 'Grok 2 (1212)',
    description: 'xAI model grok-2-1212 with text input capabilities. Supports text generation with a 131,072 token context window. (Not available as of October 2025)',
    contextWindow: 131072,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    chatPrice: { input: 2, output: 10 },
    // Fuzzy matched with "grok-2-2024-08-13" (1288) => wrong, but still we need a fallback
    benchmark: { cbaElo: 1288 },
  },

  // Grok Beta (all deprecated)
  {
    isLegacy: true,
    idPrefix: 'grok-vision-beta',
    label: 'Grok Vision Beta',
    description: 'xAI model grok-vision-beta with image and text input capabilities. Supports text generation with an 8,192 token context window.',
    contextWindow: 8192,
    maxCompletionTokens: undefined,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision],
    chatPrice: { input: 5, output: 15 },
    hidden: true,
  },
  {
    isLegacy: true,
    idPrefix: 'grok-beta',
    label: 'Grok Beta',
    description: 'xAI model grok-beta (deprecated) with text input capabilities. Supports text generation with a 131,072 token context window.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 5, output: 15 },
    hidden: true,
  },
];


// xAI Model Descriptions
export async function xaiFetchModelDescriptions(access: OpenAIAccessSchema): Promise<ModelDescriptionSchema[]> {

  // List models
  const { headers, url } = openAIAccess(access, null, '/v1/language-models');
  const modelsResponse = await fetchJsonOrTRPCThrow({ url, headers, name: 'xAI' });

  const xaiModels = wireXAIModelsListSchema.parse(modelsResponse);

  return xaiModels.models.reduce((acc, xm) => {

    // Fallback for unknown models
    const unknownModelFallback: KnownModel = {
      idPrefix: xm.id,
      label: _xaiFormatNewModelLabel(xm.id),
      description: `xAI model ${xm.id}`,
      contextWindow: 16384,
      interfaces: [
        LLM_IF_OAI_Chat,
        LLM_IF_OAI_Fn,
        ...(xm.input_modalities?.includes('image') ? [LLM_IF_OAI_Vision] : []),
      ],
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
