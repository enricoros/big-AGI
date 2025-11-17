import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';

// - Models & Pricing: https://www.alibabacloud.com/help/en/model-studio/models
// - Billing Guide: https://www.alibabacloud.com/help/en/model-studio/billing-for-model-studio
// Note: Alibaba uses tiered pricing (cost varies by input token count per request)

const _knownAlibabaChatModels: ManualMappings = [

  // NOTE: we removed all the content list, since Alibaba is switching from the former naming e.g. 'qwen-max' to
  //       more appropriate names, however we don't have pricing or more info about those models yet

];

// NOTE:

export function alibabaModelFilter(modelId: string): boolean {
  // Filter out non-chat models (embeddings, audio, image generation, etc.)
  const excludePatterns = [
    'text-embedding',       // Embedding models
    'qwen-image',          // Image generation/edit
    'qwen3-tts',           // Text-to-speech
    'qwen3-s2s',           // Speech-to-speech
    'qwen3-livetranslate', // Live translation (audio)
    'captioner',           // Image captioning (not chat)
    'qwen-mt-',            // Translation models (use regular chat models instead)
    'qwen3-omni',          // Omni models (audio/video - complex, not standard chat)
    'qwen-omni-turbo',     // Omni models (audio/video - complex, not standard chat)
    'qwen2-7b',     // Omni models (audio/video - complex, not standard chat)
  ];

  return !excludePatterns.some(pattern => modelId.includes(pattern));
}

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
  // Sort by creation date (newest first)
  const aCreated = a.created || 0;
  const bCreated = b.created || 0;
  if (aCreated !== bCreated)
    return bCreated - aCreated; // Descending order (newest first)

  // sort by the order in the known models list
  const aIndex = _knownAlibabaChatModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownAlibabaChatModels.findIndex(m => b.id.startsWith(m.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;

  // Fallback to alphabetical sorting if creation dates are the same
  return a.id.localeCompare(b.id);
}