import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, type ManualMappings } from '../../models.mappings';


// [LocalAI]
const _knownLocalAIChatModels: ManualMappings = [];
const _knownLocalAIPrice = { input: 'free', output: 'free' } as const;
// non-chat models to hide: matched as substrings of the model id, as LocalAI ids are user-chosen
// gallery names (verified live 2026-08-06 against an instance also serving sd-3.5-*-ggml, dreamshaper,
// kitten-tts, kokoro and silero-vad, none of which the previous exact-id list caught)
const _hideLocalAIModels = [
  'reranker', // vector search
  'stablediffusion', 'sd-', 'sdxl', 'dreamshaper', 'flux', // text-to-image
  'embedding', // embedding generators
  'tts', 'kokoro', // text-to-speech
  'whisper', // speech-to-text
  '-vad', // voice activity detection
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
  if (['vision', 'llava', '-vl-', 'minicpm-v'].some(match => modelId.includes(match)))
    interfaces.push(LLM_IF_OAI_Vision);
  if (['r1', 'thinking', 'reasoning', 'qwq'].some(match => modelId.includes(match)))
    interfaces.push(LLM_IF_OAI_Reasoning);

  return fromManualMapping(_knownLocalAIChatModels, modelId, undefined, undefined, {
    idPrefix: modelId,
    label,
    description,
    contextWindow: null, // 'not provided'
    interfaces,
    // parameterSpecs
    // maxCompletionTokens
    // benchmark
    chatPrice: _knownLocalAIPrice,
    hidden: _hideLocalAIModels.some(match => modelId.includes(match)),
  });
}
