import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, type ManualMappings } from '../../models.mappings';


// [LocalAI]
const _knownLocalAIChatModels: ManualMappings = [];
const _knownLocalAIPrice = { input: 'free', output: 'free' } as const;
const _hideLocalAIModels = [
  'jina-reranker-v1-base-en', // vector search
  'stablediffusion', // text-to-image
  'text-embedding-ada-002', // embedding generator
  'tts-1', // text-to-speech
  'whisper-1', // speech-to-text
];

export function localAIModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // hidden to the bottom
  if (a.hidden && !b.hidden) return 1;
  if (!a.hidden && b.hidden) return -1;

  // keep the order from the API
  return 0;
}


export function localAIModelToModelDescription(modelId: string): ModelDescriptionSchema {

  // heuristics to extract a label from the model ID
  const label = modelId
    .replace('.gguf', '')
    .replace('ggml-', '')
    .replace('.bin', '')
    .replaceAll('-', ' ')
    .replace(' Q4_K_M', ' (Q4_K_M)')
    .replace(' F16', ' (F16)')
    .split(' ')
    .map(serverCapitalizeFirstLetter)
    .join(' ');

  const description = `LocalAI model. File: ${modelId}`;

  // very dull heuristics
  const interfaces = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];
  if (modelId.includes('vision') || modelId.includes('llava'))
    interfaces.push(LLM_IF_OAI_Vision);
  if (modelId.includes('r1'))
    interfaces.push(LLM_IF_OAI_Reasoning);

  return fromManualMapping(_knownLocalAIChatModels, modelId, undefined, undefined, {
    idPrefix: modelId,
    label,
    description,
    contextWindow: null, // 'not provided'
    interfaces,
    // parameterSpecs
    // maxCompletionTokens
    // trainingDataCutoff
    // benchmark
    chatPrice: _knownLocalAIPrice,
    hidden: _hideLocalAIModels.includes(modelId),
  });
}
