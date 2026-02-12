import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';


// Interfaces for Z.ai models
const ZAI_IF_Chat = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json];
const ZAI_IF_Reasoning = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning];
const ZAI_IF_Vision = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision];

// Known Z.ai Models - Manual Mappings
const _knownZAIChatModels: ManualMappings = [

  // GLM-5 Series - Flagship (Agentic Engineering)
  {
    idPrefix: 'glm-5',
    label: 'GLM-5',
    description: 'Z.ai flagship foundation model (744B MoE, 40B activated). Designed for Agentic Engineering with SOTA coding and agent capabilities. Supports thinking mode.',
    contextWindow: 204800, // 200K
    interfaces: ZAI_IF_Reasoning,
    maxCompletionTokens: 131072, // 128K
  },

  // GLM-4.7 Series - Latest models
  {
    idPrefix: 'glm-4.7',
    label: 'GLM-4.7',
    description: 'Latest GLM model with 128K context window. Supports JSON output and function calling.',
    contextWindow: 131072, // 128K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 131072,
  },
  {
    idPrefix: 'glm-4.7-flash',
    label: 'GLM-4.7 Flash',
    description: 'Fast GLM-4.7 variant with 128K context window. Optimized for speed.',
    contextWindow: 131072, // 128K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 131072,
  },
  {
    idPrefix: 'glm-4.7-flashx',
    label: 'GLM-4.7 FlashX',
    description: 'Extended GLM-4.7 Flash variant with 128K context window.',
    contextWindow: 131072, // 128K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 131072,
  },

  // GLM-4.6 Series
  {
    idPrefix: 'glm-4.6v-flash',
    label: 'GLM-4.6V Flash',
    description: 'Fast vision-enabled GLM-4.6 variant with 128K context window.',
    contextWindow: 131072, // 128K
    interfaces: ZAI_IF_Vision,
    maxCompletionTokens: 32768,
  },
  {
    idPrefix: 'glm-4.6v-flashx',
    label: 'GLM-4.6V FlashX',
    description: 'Extended fast vision-enabled GLM-4.6 variant with 128K context window.',
    contextWindow: 131072, // 128K
    interfaces: ZAI_IF_Vision,
    maxCompletionTokens: 32768,
  },
  {
    idPrefix: 'glm-4.6v',
    label: 'GLM-4.6V',
    description: 'Vision-enabled GLM-4.6 model with 128K context window. Supports image inputs.',
    contextWindow: 131072, // 128K
    interfaces: ZAI_IF_Vision,
    maxCompletionTokens: 32768,
  },
  {
    idPrefix: 'glm-4.6',
    label: 'GLM-4.6',
    description: 'GLM-4.6 model with 128K context window. Supports JSON output and function calling.',
    contextWindow: 131072, // 128K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 131072,
  },

  // GLM-4.5 Series
  {
    idPrefix: 'glm-4.5v',
    label: 'GLM-4.5V',
    description: 'Vision-enabled GLM-4.5 model with 96K context window. Supports image inputs.',
    contextWindow: 98304, // 96K
    interfaces: ZAI_IF_Vision,
    maxCompletionTokens: 16384,
  },
  {
    idPrefix: 'glm-4.5-flash',
    label: 'GLM-4.5 Flash',
    description: 'Fast GLM-4.5 variant with 96K context window. Optimized for speed.',
    contextWindow: 98304, // 96K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 98304,
  },
  {
    idPrefix: 'glm-4.5-airx',
    label: 'GLM-4.5 AirX',
    description: 'Extended lightweight GLM-4.5 variant with 96K context window.',
    contextWindow: 98304, // 96K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 98304,
  },
  {
    idPrefix: 'glm-4.5-air',
    label: 'GLM-4.5 Air',
    description: 'Lightweight GLM-4.5 variant with 96K context window.',
    contextWindow: 98304, // 96K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 98304,
  },
  {
    idPrefix: 'glm-4.5-x',
    label: 'GLM-4.5 X',
    description: 'Extended GLM-4.5 model with 96K context window.',
    contextWindow: 98304, // 96K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 98304,
  },
  {
    idPrefix: 'glm-4.5',
    label: 'GLM-4.5',
    description: 'GLM-4.5 model with 96K context window. Supports JSON output and function calling.',
    contextWindow: 98304, // 96K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 98304,
  },

  // GLM-4 Special Models
  {
    idPrefix: 'glm-4-32b-0414-128k',
    label: 'GLM-4 32B (0414) 128K',
    description: 'GLM-4 32B model with 128K context window.',
    contextWindow: 131072, // 128K
    interfaces: ZAI_IF_Chat,
    maxCompletionTokens: 16384,
  },

];

const _unsupportedModelIds: string[] = [
  // Add any unsupported model IDs here
];

export function zaiModelFilter(zaiModelId: string) {
  return !_unsupportedModelIds.includes(zaiModelId);
}

export function zaiModelToModelDescription(zaiModelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownZAIChatModels, zaiModelId, undefined, undefined, {
    idPrefix: zaiModelId,
    label: zaiModelId.replaceAll(/[_-]/g, ' '),
    description: 'New Z.ai Model',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

// Models to inject if not returned by the API
const _zaiHardcodedModelIds = ['glm-5'];

export function zaiInjectMissingModels(models: ModelDescriptionSchema[]): ModelDescriptionSchema[] {
  const existingIds = new Set(models.map(m => m.id));
  const missing = _zaiHardcodedModelIds
    .filter(id => !existingIds.has(id))
    .map(id => zaiModelToModelDescription(id));
  return [...missing, ...models];
}

export function zaiModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema) {
  // sort by the order in the known models list
  const aIndex = _knownZAIChatModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownZAIChatModels.findIndex(m => b.id.startsWith(m.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  return a.id.localeCompare(b.id);
}
