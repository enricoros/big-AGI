import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';


const _knownMiniMaxChatModels: ManualMappings = [
  // [MiniMax API Docs](https://platform.minimaxi.com/document/models)
  {
    idPrefix: 'MiniMax-M2.7',
    label: 'MiniMax M2.7',
    description: 'Latest MiniMax model with advanced reasoning and improved instruction following. OpenAI-compatible API.',
    contextWindow: 204800, // 200K
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision],
  },
  {
    idPrefix: 'MiniMax-M2.5',
    label: 'MiniMax M2.5',
    description: 'Powerful general-purpose model with 204K context. Supports function calling, JSON mode, and vision.',
    contextWindow: 204800, // 200K
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision],
  },
  {
    idPrefix: 'MiniMax-M2.5-highspeed',
    label: 'MiniMax M2.5 High-Speed',
    description: 'Optimized variant of M2.5 for low-latency applications. 204K context with function calling support.',
    contextWindow: 204800, // 200K
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision],
  },
];

export function minimaxModelFilter(minimaxModelId: string): boolean {
  // filter out embedding and non-chat models
  return !minimaxModelId.startsWith('embo-') && !minimaxModelId.startsWith('speech-');
}

export function minimaxModelToModelDescription(minimaxModelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownMiniMaxChatModels, minimaxModelId, undefined, undefined, {
    idPrefix: minimaxModelId,
    label: minimaxModelId.replaceAll(/[_-]/g, ' '),
    description: 'New MiniMax Model',
    contextWindow: 204800,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

export function minimaxHardcodedModelDescriptions(): ModelDescriptionSchema[] {
  return _knownMiniMaxChatModels.map(m => minimaxModelToModelDescription(m.idPrefix));
}

export function minimaxModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort by the order in the known models list, using longest prefix match
  const findBestIndex = (id: string) => {
    let bestIdx = -1;
    let bestLen = 0;
    _knownMiniMaxChatModels.forEach((m, idx) => {
      if (id.startsWith(m.idPrefix) && m.idPrefix.length > bestLen) {
        bestIdx = idx;
        bestLen = m.idPrefix.length;
      }
    });
    return bestIdx;
  };
  const aIndex = findBestIndex(a.id);
  const bIndex = findBestIndex(b.id);
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;
  return a.id.localeCompare(b.id);
}
