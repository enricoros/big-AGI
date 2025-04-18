import { LLM_IF_HOTFIX_NoTemperature, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from './models.data';


const _knownDeepseekChatModels: ManualMappings = [
  // [Models and Pricing](https://api-docs.deepseek.com/quick_start/pricing)
  // [List Models](https://api-docs.deepseek.com/api/list-models)
  {
    idPrefix: 'deepseek-reasoner',
    label: 'DeepSeek-R1',
    description: 'Reasoning model with Chain-of-Thought capabilities, 64K context length. No discount.',
    contextWindow: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_NoTemperature],
    maxCompletionTokens: 8192,
    chatPrice: { input: 0.55, output: 2.19, cache: { cType: 'oai-ac', read: 0.14 } },
    benchmark: { cbaElo: 1358 },
  },
  {
    idPrefix: 'deepseek-chat',
    label: 'DeepSeek-V3',
    description: 'General-purpose model with 64K context length.',
    contextWindow: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json],
    maxCompletionTokens: 8192,
    chatPrice: { input: 0.27, output: 1.10, cache: { cType: 'oai-ac', read: 0.07 } },
    benchmark: { cbaElo: 1372 }, // note: this is for V3-0324, before V3 was 1318
  },
  {
    idPrefix: 'deepseek-coder',
    label: 'DeepSeek Coder V2',
    description: 'Good at coding and math tasks, 128K context length',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
    maxCompletionTokens: 4096,
    // chatPrice: { input: 0.14, output: 0.28 },
    benchmark: { cbaElo: 1214 }, // assuming this is deepseek-coder-v2-0724
    hidden: true,
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
    interfaces: [LLM_IF_OAI_Chat], // assume..
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
