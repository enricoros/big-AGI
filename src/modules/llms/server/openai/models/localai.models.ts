import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import { serverCapitalizeFirstLetter } from '~/server/wire';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, type ManualMappings } from '../../models.mappings';


// [LocalAI]
const _knownLocalAIChatModels: ManualMappings = [];
const _knownLocalAIPrice = { input: 'free', output: 'free' } as const;
// non-chat models to hide: matched as LOWERCASED substrings of the model id, as LocalAI ids are
// user-chosen gallery names.
// [LocalAI, 2026-08-17] re-derived against the whole gallery index (mudler/LocalAI gallery/index.yaml,
// 1683 entries): the previous list hid 93 and matched case-sensitively, so the four
// 'Qwen3-VL-Embedding/Reranker-*-GGUF' ids slipped through (a gallery entry's `overrides.name` wins over
// its lowercase entry name and becomes the served id). Now 440 hide; the only chat-tagged entries caught
// are embedding models the gallery itself mis-tags ('bert-embeddings', 'qwen3-embedding-*').
const _hideLocalAIModels = [
  'rerank', // vector search
  'stablediffusion', 'sd-', 'sdxl', 'dreamshaper', 'flux', // text-to-image
  'ltx-', // text-to-video / image-to-video
  'embed', // embedding generators
  'tts', 'kokoro', 'piper-', 'voice-', 'vibevoice', 'omnivoice', 'chatterbox', 'supertonic', 'higgs-audio', // text-to-speech ('voice-' = the piper voice pack + voice-detect-* speaker ID)
  'ace-step', 'acestep', 'stable-audio', // music / sound generation
  'whisper', 'crispasr', 'parakeet', 'canary', 'fastconformer', 'citrinet', 'sortformer', // speech-to-text
  'wav2vec', 'hubert', 'data2vec', 'moss-transcribe', 'glm-asr', // speech-to-text (cont.)
  'audio-cpp', // LocalAI audio backend pack: asr, forced alignment, voice design/conversion
  'demucs', 'vevo2', // source separation, speech-to-speech
  '-vad', // voice activity detection
  'depth-anything', // depth estimation
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
    hidden: _hideLocalAIModels.some(match => modelId.toLowerCase().includes(match)),
  });
}
