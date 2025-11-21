import * as z from 'zod/v4';

import { LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from '../../models.mappings';


const IF_K2 = [
  LLM_IF_HOTFIX_StripImages, // TEMPORARY HOTFIX - all these K2 models don't support images yet
  LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching,
  // LLM_IF_Tools_WebSearch // NOT YET
];
const IF_K2_REASON = [...IF_K2, LLM_IF_OAI_Reasoning];


/**
 * Moonshot AI (Kimi) models.
 * - models list and pricing: https://platform.moonshot.ai/docs/pricing/chat
 * - API docs: https://platform.moonshot.ai/docs/api/chat
 * - updated: 2025-11-09
 */
const _knownMoonshotModels: ManualMappings = [

  // Kimi K2 Series - Latest Models

  // Fast, Thinking
  {
    idPrefix: 'kimi-k2-thinking-turbo',
    label: 'Kimi K2 Thinking Turbo',
    description: 'High-speed reasoning model with advanced thinking and tool calling capabilities. Faster inference with optimized performance. 256K context, 32K output. Temperature 1.0 recommended.',
    contextWindow: 262144,
    maxCompletionTokens: 32768,
    interfaces: IF_K2_REASON,
    chatPrice: { input: 1.15, output: 8.00, cache: { cType: 'oai-ac', read: 0.15 } },
    benchmark: { cbaElo: 1417 + 1 }, // UNKNOWN +1 over 0905, but don't want to be above the non-turbo
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }], // NOT WORKING YET
  },
  // Thinking
  {
    idPrefix: 'kimi-k2-thinking',
    label: 'Kimi K2 Thinking',
    description: 'Advanced reasoning model with multi-step thinking and autonomous tool calling (200-300 sequential calls). Interleaves chain-of-thought with tool use. 256K context, 32K output. Temperature 1.0 recommended.',
    contextWindow: 262144,
    maxCompletionTokens: 32768,
    interfaces: IF_K2_REASON,
    chatPrice: { input: 0.60, output: 2.50, cache: { cType: 'oai-ac', read: 0.15 } },
    benchmark: { cbaElo: 1417 + 2 }, // UNKNOWN +2 over 0905, to be at the top here
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }],
  },

  // K2
  {
    idPrefix: 'kimi-k2-0905-preview',
    label: 'Kimi K2 0905 (Preview)',
    description: 'Preview variant of K2 0905 with extended 256K context. For testing latest features before production.',
    contextWindow: 262144,
    maxCompletionTokens: 16384,
    interfaces: IF_K2,
    chatPrice: { input: 0.60, output: 2.50, cache: { cType: 'oai-ac', read: 0.15 } },
    isPreview: true,
    benchmark: { cbaElo: 1417 },
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }],
  },
  {
    hidden: true,
    idPrefix: 'kimi-k2-0711-preview',
    label: 'Kimi K2 0711 (Preview)',
    description: 'Earlier preview variant with 128K context. Superseded by 0905 version.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: IF_K2,
    chatPrice: { input: 0.60, output: 2.50, cache: { cType: 'oai-ac', read: 0.15 } },
    isPreview: true,
    benchmark: { cbaElo: 1415 },
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }],
  },
  {
    idPrefix: 'kimi-k2-turbo-preview',
    label: 'Kimi K2 Turbo (Preview)',
    description: 'High-speed variant with 60-100 tokens/second output. 256K context. Optimized for real-time applications. Recommended for web search due to dynamic context handling.',
    contextWindow: 262144,
    maxCompletionTokens: 16384,
    interfaces: IF_K2,
    chatPrice: { input: 1.15, output: 8.00, cache: { cType: 'oai-ac', read: 0.15 } },
    isPreview: true,
    // parameterSpecs: [{ paramId: 'llmVndMoonshotWebSearch' }],
  },

  // Legacy Moonshot V1 Models (deprecated, prefer K2 series)
  {
    idPrefix: 'moonshot-v1-128k',
    label: 'V1 128K',
    description: 'Legacy V1 model with 128K context. Deprecated - use Kimi K2 Instruct instead.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 2.00, output: 5.00 },
    hidden: true,
  },
  {
    idPrefix: 'moonshot-v1-32k',
    label: 'V1 32K',
    description: 'Legacy V1 model with 32K context. Deprecated - use Kimi K2 Instruct instead.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1.00, output: 3.00 },
    hidden: true,
  },
  {
    idPrefix: 'moonshot-v1-8k',
    label: 'V1 8K',
    description: 'Legacy V1 model with 8K context. Deprecated - use Kimi K2 Instruct instead.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 2.00 },
    hidden: true,
  },

  // Vision Models
  {
    // hidden: false, not hidden - only non-hidden vision for now
    idPrefix: 'moonshot-v1-128k-vision-preview',
    label: 'V1 128K Vision (Preview)',
    description: 'Legacy vision model with 128K context. Preview variant - use moonshot-v1-vision for production.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 2.00, output: 5.00 },
    isPreview: true,
  },
  {
    idPrefix: 'moonshot-v1-32k-vision-preview',
    label: 'V1 32K Vision (Preview)',
    description: 'Legacy vision model with 32K context. Preview variant - use moonshot-v1-vision for production.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 1.00, output: 3.00 },
    isPreview: true,
    hidden: true,
  },
  {
    idPrefix: 'moonshot-v1-8k-vision-preview',
    label: 'V1 8K Vision (Preview)',
    description: 'Legacy vision model with 8K context. Preview variant - use moonshot-v1-vision for production.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.20, output: 2.00 },
    isPreview: true,
    hidden: true,
  },

];


// Excluded models: aliases, embeddings, and unknown variants
const _excludedMoonshotModels = [
  'kimi-latest',
  'kimi-thinking-preview',
  'moonshot-v1-auto',
  'moonshot-v1-vision',
] as const;

export function moonshotModelFilter(model: { id: string }): boolean {
  // Filter out excluded models
  return !_excludedMoonshotModels.some(excluded => model.id === excluded);
}

const _wireMoonshotModelsListOutputSchema = z.object({
  id: z.string(),
  object: z.literal('model'),
  created: z.number().optional(),
  owned_by: z.string().optional(),
  context_length: z.number().optional(),
  // permission, root, parent fields are present but not used
});

export function moonshotModelToModelDescription(_model: unknown): ModelDescriptionSchema {
  const model = _wireMoonshotModelsListOutputSchema.parse(_model);

  // warn if the context window or other details differ from known mappings
  const knownModel = _knownMoonshotModels.find(base => model.id.startsWith(base.idPrefix));
  if (!knownModel)
    console.log(`moonshot.models: unknown model ${model.id}`, model);

  const description = fromManualMapping(_knownMoonshotModels, model.id, model.created, undefined, {
    // NOTE: default: let us know if any of these show up
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'Unknown Moonshot Model',
    contextWindow: model.context_length || 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_PromptCaching],
    hidden: model.id.startsWith('moonshot-'), // hide older
  });

  // warn if API-reported context_length differs from our known mapping
  if (knownModel && model.context_length && model.context_length !== description.contextWindow)
    console.warn(`moonshot.models: context_length mismatch for ${model.id}: API reports ${model.context_length}, we have ${description.contextWindow}`);

  return description;
}

export function moonshotModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort hidden at the end
  if (a.hidden && !b.hidden) return 1;
  if (!a.hidden && b.hidden) return -1;

  // sort preview models after production
  // FIXME: this needs to be done before..
  // if (a.isPreview && !b.isPreview)
  //   return 1;
  // if (!a.isPreview && b.isPreview)
  //   return -1;

  // sort as per their order in the known models
  const aIndex = _knownMoonshotModels.findIndex(base => a.id.startsWith(base.idPrefix));
  const bIndex = _knownMoonshotModels.findIndex(base => b.id.startsWith(base.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;

  return a.id.localeCompare(b.id);
}
