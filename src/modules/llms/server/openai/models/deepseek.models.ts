import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from './models.data';


const _knownDeepseekChatModels: ManualMappings = [
  // [Models and Pricing](https://api-docs.deepseek.com/quick_start/pricing)
  // [List Models](https://api-docs.deepseek.com/api/list-models)
  {
    idPrefix: 'deepseek-reasoner',
    label: 'DeepSeek R1 (0528)',
    description: 'Reasoning model with Chain-of-Thought capabilities, 64K context length. Supports JSON output and function calling.',
    contextWindow: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 32768, // default, max: 65536,
    chatPrice: { input: 0.55, output: 2.19, cache: { cType: 'oai-ac', read: 0.14 } },
    benchmark: { cbaElo: 1358 },
  },
  {
    idPrefix: 'deepseek-chat',
    label: 'DeepSeek V3 (0324)',
    description: 'General-purpose model with 64K context length. Supports JSON output and function calling.',
    contextWindow: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    maxCompletionTokens: 8192, // default is 4096, max is 8192
    chatPrice: { input: 0.27, output: 1.10, cache: { cType: 'oai-ac', read: 0.07 } },
    benchmark: { cbaElo: 1372 }, // note: this is for V3-0324, before V3 was 1318
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
