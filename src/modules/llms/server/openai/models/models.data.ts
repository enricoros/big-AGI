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

export type ManualMappings = (KnownModel | KnownLink)[];

/**
 * Server-side default model description to complement the APIs usually just returning the model ID
 */
export type KnownModel = {
  idPrefix: string,
  isPreview?: boolean,
  isLegacy?: boolean,
} & Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated'>;

/**
 * Symlink -> KnownModel; all properties except overrides are inherited from the target model.
 */
type KnownLink = {
  idPrefix: string;
  label: string;        // Forcing the label, otherwise we'll just use the target's, which is wrong
  symLink: string;      // -> KnownModel.idPrefix
} & Partial<Omit<ModelDescriptionSchema, 'id' | 'created' | 'updated'>>;


export function fromManualMapping(mappings: (KnownModel | KnownLink)[], upstreamModelId: string, created: undefined | number, updated: undefined | number, fallback: KnownModel, disableSymlinkLooks?: boolean): ModelDescriptionSchema {

  // model resolution outputs
  let m: KnownModel;
  let symlinkTarget: string | undefined;
  let resolution: 'exact' | 'super' | 'fallback' = 'exact';

  // just scope this to avoid leaking
  {
    // find a perfect match first
    let known = mappings.find(base => upstreamModelId === base.idPrefix);
    if (!known) {
      // find the longest prefix match
      const prefixMatches = mappings.filter(base => upstreamModelId.startsWith(base.idPrefix));
      if (prefixMatches.length) {
        known = prefixMatches.sort((a, b) => b.idPrefix.length - a.idPrefix.length)[0];
        resolution = 'super';
      } else {
        // fallback last
        // console.warn(`[fromManualMapping] Unknown model: ${upstreamModelId}, falling back to ${fallback.idPrefix}`);
        known = fallback;
        resolution = 'fallback';
      }
    }

    // dereference symlink
    if ('symLink' in known) {
      const l = known;
      symlinkTarget = l.symLink;
      const lM = mappings.find(m => m.idPrefix === l.symLink);
      if (lM && !('symLink' in lM)) {
        // merge target + link overrides (symlinks are hidden by default)
        const { idPrefix, symLink, hidden = undefined, ...overrides } = l;
        m = {
          ...lM,
          ...overrides,
          idPrefix, // NOTE: we use the 'base' for broader variant extraction below
          hidden: hidden ?? true, // by default hide symlinks, unless overridden
        };
      } else {
        // WARNING: we found a symlink, but the target is missing or another symlink - hence we fallback, but this is a warning situation
        console.warn(!lM
          ? `[fromManualMapping] Symlink target not found: ${l.idPrefix} -> ${l.symLink}`
          : `[fromManualMapping] Symlink chain detected: ${l.idPrefix} -> ${l.symLink} (not supported)`,
        );
        m = fallback;
        resolution = 'fallback';
      }
    } else {
      m = known;
    }
  }

  // check whether this is a partial map, which indicates an unknown/new variant
  const variant = upstreamModelId.slice(m.idPrefix.length).replaceAll('-', ' ').trim();

  // build label (a bit tricky)
  let label = m.label;
  let description = m.description || '';
  if (variant)
    label += ` [${variant}]`;
  if (resolution === 'super') {
    label = `[?] ${label}`;
    delete m.hidden;
  } else if (!disableSymlinkLooks && symlinkTarget) {
    // add a symlink icon to the label
    label = `🔗 ${label} → ${symlinkTarget/*.replace(known.idPrefix, '')*/}`;

    // add an automated 'points to...' to the description, lifted from the base model
    if (!description.includes('Points to '))
      description += ` Points to ${symlinkTarget}.`;
  }
  // if (m.isLegacy) label += /*' 💩'*/ ' [legacy]'; // Disabled: visual noise

  // create ModelDescription
  const md: ModelDescriptionSchema = {
    id: upstreamModelId,
    label,
    created: created || 0,
    updated: updated || created || 0,
    description,
    contextWindow: m.contextWindow,
    interfaces: m.interfaces,
  };

  // apply optional fields
  if (m.parameterSpecs) md.parameterSpecs = m.parameterSpecs;
  if (m.maxCompletionTokens) md.maxCompletionTokens = m.maxCompletionTokens;
  if (m.trainingDataCutoff) md.trainingDataCutoff = m.trainingDataCutoff;
  if (m.benchmark) md.benchmark = m.benchmark;
  if (m.chatPrice) md.chatPrice = m.chatPrice;
  if (m.hidden) md.hidden = true;

  return md;
}