import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from './models.data';

// - Models: https://www.alibabacloud.com/help/en/model-studio/getting-started/models
// - Pricing: https://www.alibabacloud.com/en/product/modelstudio?_p_lc=1&spm=a3c0i.11852017.6791778070.50.46f07ac9erixlG#J_9325669630

const _knownAlibabaChatModels: ManualMappings = [
  // Commercial Models
  {
    idPrefix: 'qwen-max',
    label: 'Qwen-Max',
    description: 'Best inference performance among Qwen models, especially for complex tasks. 32K context.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 8192,
    chatPrice: { input: 1.6, output: 6.4 },
    benchmark: { cbaElo: 1340 },
  },
  {
    idPrefix: 'qwen-plus',
    label: 'Qwen-Plus',
    description: 'Balanced performance, speed, and cost. 131K context.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 8192,
    chatPrice: { input: 0.4, output: 1.2 },
    benchmark: { cbaElo: 1310 },
  },
  {
    idPrefix: 'qwen-turbo',
    label: 'Qwen-Turbo',
    description: 'Fast speed and low cost, suitable for simple tasks. 1M context.',
    contextWindow: 1000000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 8192,
    chatPrice: { input: 0.05, output: 0.2 },
    // unknown/unreported benchmark
  },

  // Vision Models
  {
    idPrefix: 'qwen-vl-max',
    label: 'Qwen-VL Max',
    description: 'Enhanced visual reasoning and instruction-following capabilities.',
    contextWindow: 7500,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    maxCompletionTokens: 1500,
    chatPrice: { input: 'free', output: 'free' }, // Time-limited free trial
  },
  {
    idPrefix: 'qwen-vl-plus',
    label: 'Qwen-VL Plus',
    description: 'Enhanced detail and text recognition for visual tasks.',
    contextWindow: 7500,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    maxCompletionTokens: 1500,
    chatPrice: { input: 'free', output: 'free' }, // Time-limited free trial
  },

  // Open Source Models - Qwen2.5
  {
    idPrefix: 'qwen2.5-72b-instruct',
    label: 'Qwen 2.5 72B',
    description: 'Latest Qwen series, 131K context.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 8192,
    chatPrice: { input: 'free', output: 'free' }, // Time-limited free trial
  },
  {
    idPrefix: 'qwen2.5-14b-instruct-1m',
    label: 'Qwen 2.5 14B (1M)',
    description: 'Latest Qwen series with 1M context.',
    contextWindow: 1000000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 8192,
    chatPrice: { input: 'free', output: 'free' }, // Time-limited free trial
  },
  {
    idPrefix: 'qwen2.5-7b-instruct-1m',
    label: 'Qwen 2.5 7B (1M)',
    description: 'Latest Qwen series with 1M context.',
    contextWindow: 1000000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 8192,
    chatPrice: { input: 'free', output: 'free' }, // Time-limited free trial
  },

  // Open Source Models - Qwen2
  {
    idPrefix: 'qwen2-7b-instruct',
    label: 'Qwen 2 7B',
    description: 'Open source Qwen2 model.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    maxCompletionTokens: 6144,
    chatPrice: { input: 'free', output: 'free' }, // Time-limited free trial
  },
] as const;


export function alibabaModelToModelDescription(alibabaModelId: string, created?: number): ModelDescriptionSchema {
  // create is a number like '1728632029' - convert to Month/Year
  // const createdDate = created ? new Date(created * 1000) : undefined;
  // const createdStr = createdDate?.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  // NOTE: as of Feb 2025, reports that the 4 Qwen models were created in Oct 2024.
  // So we're not using the created date for now, as to not confuse Users.
  return fromManualMapping(_knownAlibabaChatModels, alibabaModelId, created, undefined, {
    idPrefix: alibabaModelId,
    label: alibabaModelId.replaceAll(/[_-]/g, ' '),
    description: 'New Alibaba Model',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision], // assume..
  });
}

export function alibabaModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema) {
  // sort by the order in the known models list
  const aIndex = _knownAlibabaChatModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownAlibabaChatModels.findIndex(m => b.id.startsWith(m.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  return a.id.localeCompare(b.id);
}