import { LLM_IF_OAI_Chat } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from './models.data';


const _knownDeepseekChatModels: ManualMappings = [
  // [Models and Pricing](https://platform.deepseek.com/api-docs/pricing)
  // [List Models](https://platform.deepseek.com/api-docs/api/list-models)
  {
    idPrefix: 'deepseek-chat',
    label: 'Deepseek Chat V3',
    description: 'General-purpose model with 64K context length. Discounted pricing until Feb 8, 2025.',
    contextWindow: 65536,
    interfaces: [LLM_IF_OAI_Chat],
    maxCompletionTokens: 8192,
    // chatPrice: { input: 0.27, output: 1.10, cache: { cType: 'oai-ac', read: 0.07 } },
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.014 } },
  },
  {
    idPrefix: 'deepseek-coder',
    label: 'Deepseek Coder V2',
    description: 'Good at coding and math tasks, 128K context length',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
    maxCompletionTokens: 4096,
    // chatPrice: { input: 0.14, output: 0.28 },
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