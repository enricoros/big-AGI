import { LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';


const IF_3 = [LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json];

const _knownDeepseekChatModels: ManualMappings = [
  // [Models and Pricing](https://api-docs.deepseek.com/quick_start/pricing)
  // [List Models](https://api-docs.deepseek.com/api/list-models)
  // [Release Notes - V3.2](https://api-docs.deepseek.com/news/news251201) - Released 2025-12-01
  {
    idPrefix: 'deepseek-reasoner',
    label: 'DeepSeek V3.2 (Reasoner)',
    description: 'Reasoning model with Chain-of-Thought capabilities, 128K context length. Supports JSON output and function calling.',
    contextWindow: 131072, // 128K
    interfaces: [...IF_3, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 32768, // default, max: 65536
    chatPrice: { input: 0.28, output: 0.42, cache: { cType: 'oai-ac', read: 0.028 } },
    benchmark: { cbaElo: 1418 }, // deepseek-r1-0528
  },
  {
    idPrefix: 'deepseek-chat',
    label: 'DeepSeek V3.2',
    description: 'General-purpose model with 128K context length. Supports JSON output and function calling.',
    contextWindow: 131072, // 128K
    interfaces: IF_3,
    maxCompletionTokens: 8192, // default is 4096, max is 8192
    chatPrice: { input: 0.28, output: 0.42, cache: { cType: 'oai-ac', read: 0.028 } },
    benchmark: { cbaElo: 1419 }, // deepseek-v3.1-thinking
  },
];

const _unsupportedModelIds = [
  'deepseek-coder',
];

export function deepseekModelFilter(deepseekModelId: string) {
  return !_unsupportedModelIds.includes(deepseekModelId);
}

export function deepseekModelToModelDescription(deepseekModelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownDeepseekChatModels, deepseekModelId, undefined, undefined, {
    idPrefix: deepseekModelId,
    label: deepseekModelId.replaceAll(/[_-]/g, ' '),
    description: 'New Deepseek Model',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

export function deepseekModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema) {
  // sort by the order in the known models list
  const aIndex = _knownDeepseekChatModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownDeepseekChatModels.findIndex(m => b.id.startsWith(m.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  return a.id.localeCompare(b.id);
}


// [DeepSeek, 2025-12-01] V3.2-Speciale: Temporary endpoint until Dec 15, 2025 15:59 UTC
// Thinking mode only (deepseek-reasoner), 128K max output, no JSON/tool calling
export const DEEPSEEK_SPECIALE_HOST = 'https://api.deepseek.com/v3.2_speciale_expires_on_20251215';
export const DEEPSEEK_SPECIALE_SUFFIX = '@speciale';

const _hardcodedDeepseekVariants: { [modelId: string]: Partial<ModelDescriptionSchema> } = {
  'deepseek-reasoner': {
    id: 'deepseek-reasoner' + DEEPSEEK_SPECIALE_SUFFIX, // [DeepSeek, 2025-12-01] marker for dispatch routing (no idVariant - the @speciale suffix serves as both)
    label: 'DeepSeek V3.2 Speciale',
    description: 'V3.2-Speciale reasoning model. 128K max output, no JSON/tool calling. Expires Dec 15, 2025.',
    interfaces: [LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning], // NO Fn, NO Json
    // contextWindow: null,
    // maxCompletionTokens: undefined, // default 64K, max 128K (higher than regular reasoner's 32K default)
  },
};

export function deepseekInjectVariants(models: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {
  // [DeepSeek, 2025-12-01] Inject Speciale variant for deepseek-reasoner
  if (_hardcodedDeepseekVariants[model.id])
    models.push({ ...model, ..._hardcodedDeepseekVariants[model.id] });
  models.push(model);
  return models;
}
