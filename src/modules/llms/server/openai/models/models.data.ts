import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { capitalizeFirstLetter } from '~/common/util/textUtils';

import type { ModelDescriptionSchema } from '../../llm.server.types';


// [LM Studio]
export function lmStudioModelToModelDescription(modelId: string): ModelDescriptionSchema {

  // LM Studio model ID's are the file names of the model files
  function getFileName(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return normalizedPath.split('/').pop() || '';
  }

  return fromManualMapping([], modelId, undefined, undefined, {
    idPrefix: modelId,
    label: getFileName(modelId)
      .replace('.gguf', '')
      .replace('.bin', ''),
    // .replaceAll('-', ' '),
    description: `Unknown LM Studio model. File: ${modelId}`,
    contextWindow: null, // 'not provided'
    interfaces: [LLM_IF_OAI_Chat], // assume..
    chatPrice: { input: 'free', output: 'free' },
  });
}


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

  // heurisics to extract a label from the model ID
  const label = modelId
    .replace('.gguf', '')
    .replace('ggml-', '')
    .replace('.bin', '')
    .replaceAll('-', ' ')
    .replace(' Q4_K_M', ' (Q4_K_M)')
    .replace(' F16', ' (F16)')
    .split(' ')
    .map(capitalizeFirstLetter)
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

// Helpers

export type ManualMapping = ({
  idPrefix: string,
  isLatest?: boolean,
  isPreview?: boolean,
  isLegacy?: boolean,
  symLink?: string
} & Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated'>);

export type ManualMappings = ManualMapping[];

export function fromManualMapping(mappings: ManualMappings, id: string, created?: number, updated?: number, fallback?: ManualMapping, disableSymLink?: boolean): ModelDescriptionSchema {

  // find the closest known model, or fall back, or take the last
  const known = mappings.find(base => id === base.idPrefix)
    || mappings.find(base => id.startsWith(base.idPrefix))
    || fallback
    || mappings[mappings.length - 1];

  // label for symlinks
  let label = known.label;
  if (!disableSymLink && known.symLink && id === known.idPrefix)
    label = `🔗 ${known.label} → ${known.symLink/*.replace(known.idPrefix, '')*/}`;

  // check whether this is a partial map, which indicates an unknown/new variant
  const suffix = id.slice(known.idPrefix.length).trim();

  // full label
  label = label
    + (suffix ? ` [${suffix.replaceAll('-', ' ').trim()}]` : '')
    // + (known.isLatest ? ' 🌟' : '') // DISABLED: annoying emoji
    + (known.isLegacy ? /*' 💩'*/ ' [legacy]' : '');

  // set the date in YYYY-MM-DD format if available and requested
  // if (label.indexOf('{{Created}}') !== -1) {
  //   const targetDate = updated || created;
  //   if (targetDate)
  //     label = label.replace('{{Created}}', `(${new Date(targetDate * 1000).toISOString().slice(0, 10)})`);
  //   else
  //     label = label.replace('{{Created}}', '');
  // }

  // create the model description
  const md: ModelDescriptionSchema = {
    id,
    label,
    created: created || 0,
    updated: updated || created || 0,
    description: known.description,
    contextWindow: known.contextWindow,
    interfaces: known.interfaces,
  };

  // apply optional fields
  if (known.maxCompletionTokens)
    md.maxCompletionTokens = known.maxCompletionTokens;
  if (known.trainingDataCutoff)
    md.trainingDataCutoff = known.trainingDataCutoff;
  if (known.parameterSpecs)
    md.parameterSpecs = known.parameterSpecs;
  if (known.benchmark)
    md.benchmark = known.benchmark;
  if (known.chatPrice)
    md.chatPrice = known.chatPrice;
  if (known.hidden)
    md.hidden = true;

  return md;
}