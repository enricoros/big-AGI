import { LLM_IF_HOTFIX_NoWebP, LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';


// Interfaces for Z.ai models
// - Thinking mode: supported by GLM-4.5 series and higher (GLM-4.5, 4.6, 4.7, 5)
// - Text-only models strip images (Z.ai API rejects image parts on non-vision models)
// - Ref: https://docs.z.ai/guides/capabilities/thinking-mode
const _IF_Chat = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_HOTFIX_StripImages];
const _IF_Reasoning = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Reasoning, LLM_IF_HOTFIX_StripImages];
const _IF_Vision_Reasoning = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Json, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning];

// Parameter specs for Z.ai models
// - Z.ai thinking maps from effort: 'none' → disabled, anything else → enabled
// - Z.ai only supports binary enabled/disabled, so we expose 'none' and 'high'
const _PS_Reasoning: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndZaiReasoningEffort' },
] as const;


// [Z.ai] Known Models - Manual Mappings
// Also used for prefix-matching 0-day API-discovered models
// Flash = free tier (1 concurrent request, throttled); FlashX = paid with higher concurrency & priority routing
// Ref: https://docs.z.ai/api-reference/chat/completions (model enum), https://docs.z.ai/guides/overview/pricing
const _knownZAIModels: ManualMappings = [

  // GLM-5 Series - Flagship (Agentic Engineering)
  // 200K context, 128K output. Thinking compulsory when enabled (default: enabled).
  {
    idPrefix: 'glm-5',
    label: 'GLM-5',
    description: 'Z.ai flagship foundation model (744B MoE, 40B activated). Designed for Agentic Engineering with SOTA coding and agent capabilities. 200K context, thinking mode.',
    contextWindow: 204800, // 200K
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 131072, // 128K
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 1, output: 3.2, cache: { cType: 'oai-ac', read: 0.2 } },
    initialTemperature: 1.0, // Z.ai default for GLM-5
  },
  {
    idPrefix: 'glm-5-code',
    label: 'GLM-5 Code',
    description: 'GLM-5 optimized for coding tasks. Uses the dedicated Coding endpoint. 200K context, thinking mode.',
    contextWindow: 204800, // 200K
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 131072, // 128K
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 1.2, output: 5, cache: { cType: 'oai-ac', read: 0.3 } },
    initialTemperature: 1.0,
    // hidden: true,
  },

  // GLM-4.7 Series
  // 128K context, 128K output. Thinking compulsory when enabled (default: enabled).
  {
    idPrefix: 'glm-4.7',
    label: 'GLM-4.7',
    description: 'Latest-gen GLM model with 128K context. Thinking mode activated by default.',
    contextWindow: 131072, // 128K
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 131072,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.6, output: 2.2, cache: { cType: 'oai-ac', read: 0.11 } },
    initialTemperature: 1.0,
  },
  {
    idPrefix: 'glm-4.7-flashx',
    label: 'GLM-4.7 FlashX', // fast, low cost
    description: 'Fast GLM-4.7 variant with priority routing and higher concurrency. Same model as Flash, better infrastructure.',
    contextWindow: 131072,
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 131072,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.07, output: 0.4, cache: { cType: 'oai-ac', read: 0.01 } },
    initialTemperature: 1.0,
  },
  {
    idPrefix: 'glm-4.7-flash',
    label: 'GLM-4.7 Flash (Free)',
    description: 'Free GLM-4.7 variant. Same model as FlashX but with limited concurrency (1 concurrent request) and lower priority.',
    contextWindow: 131072,
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 131072,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 'free', output: 'free' },
    initialTemperature: 1.0,
  },

  // GLM-4.6V Series (Vision + Reasoning)
  // 128K context, 32K output. Hybrid thinking (auto-determines whether to think).
  {
    idPrefix: 'glm-4.6v-flashx',
    label: 'GLM-4.6 V FlashX',
    description: 'Fast vision GLM-4.6 with priority routing and higher concurrency. Image/video/file inputs, 32K output.',
    contextWindow: 131072,
    interfaces: _IF_Vision_Reasoning,
    maxCompletionTokens: 32768,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.04, output: 0.4, cache: { cType: 'oai-ac', read: 0.004 } },
    initialTemperature: 0.8, // Z.ai default for vision models
    hidden: true,
  },
  {
    idPrefix: 'glm-4.6v-flash',
    label: 'GLM-4.6 V Flash (Free)',
    description: 'Free vision GLM-4.6. Same model as FlashX but with limited concurrency (1 concurrent request). Image/video/file inputs, 32K output.',
    contextWindow: 131072,
    interfaces: _IF_Vision_Reasoning,
    maxCompletionTokens: 32768,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 'free', output: 'free' },
    initialTemperature: 0.8,
  },
  {
    idPrefix: 'glm-4.6v',
    label: 'GLM-4.6 V',
    description: 'Vision-enabled GLM-4.6 model. Supports image/video/file inputs, 32K output, hybrid thinking.',
    contextWindow: 131072,
    interfaces: _IF_Vision_Reasoning,
    maxCompletionTokens: 32768,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.3, output: 0.9, cache: { cType: 'oai-ac', read: 0.05 } },
    initialTemperature: 0.8,
  },

  // GLM-4.6 Text
  // 128K context, 128K output. Hybrid thinking (auto-determines whether to think).
  {
    idPrefix: 'glm-4.6',
    label: 'GLM-4.6',
    description: 'GLM-4.6 model with 128K context/output. Hybrid thinking: auto-determines whether to engage deep reasoning.',
    contextWindow: 131072,
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 131072,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.6, output: 2.2, cache: { cType: 'oai-ac', read: 0.11 } },
    initialTemperature: 1.0,
  },

  // GLM-OCR (Vision, no reasoning)
  {
    idPrefix: 'glm-ocr',
    label: 'GLM-OCR (Vision, OCR)',
    description: 'Specialized OCR model for text extraction from images and documents.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_HOTFIX_NoWebP],
    maxCompletionTokens: 4096,
    chatPrice: { input: 0.03, output: 0.03 },
    initialTemperature: 0.8,
    // hidden: true,
  },

  // GLM-4.5V (Vision + Reasoning)
  // 96K context, 16K output. Supports interleaved thinking.
  {
    idPrefix: 'glm-4.5v',
    label: 'GLM-4.5 V',
    description: 'Vision-enabled GLM-4.5 model. 96K context, 16K output, interleaved thinking.',
    contextWindow: 98304, // 96K
    interfaces: _IF_Vision_Reasoning,
    maxCompletionTokens: 16384,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.6, output: 1.8, cache: { cType: 'oai-ac', read: 0.11 } },
    initialTemperature: 0.8,
    hidden: true,
  },

  // GLM-4.5 Text Series
  // 96K context, 96K output. Supports interleaved thinking.
  {
    idPrefix: 'glm-4.5-flash',
    label: 'GLM-4.5 Flash (Free)',
    description: 'Free GLM-4.5 variant with limited concurrency. Prior-gen, superseded by GLM-4.7 Flash.',
    contextWindow: 98304,
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 98304,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 'free', output: 'free' },
    initialTemperature: 0.6, // Z.ai default for GLM-4.5
    hidden: true,
  },
  {
    idPrefix: 'glm-4.5-airx',
    label: 'GLM-4.5 AirX',
    description: 'Extended lightweight GLM-4.5 variant. Interleaved thinking.',
    contextWindow: 98304,
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 98304,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 1.1, output: 4.5, cache: { cType: 'oai-ac', read: 0.22 } },
    initialTemperature: 0.6,
    hidden: true,
  },
  {
    idPrefix: 'glm-4.5-air',
    label: 'GLM-4.5 Air',
    description: 'Lightweight GLM-4.5 variant. Interleaved thinking.',
    contextWindow: 98304,
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 98304,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.2, output: 1.1, cache: { cType: 'oai-ac', read: 0.03 } },
    initialTemperature: 0.6,
    hidden: true,
  },
  {
    idPrefix: 'glm-4.5-x',
    label: 'GLM-4.5 X',
    description: 'Extended GLM-4.5 model. Interleaved thinking.',
    contextWindow: 98304,
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 98304,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 2.2, output: 8.9, cache: { cType: 'oai-ac', read: 0.45 } },
    initialTemperature: 0.6,
    hidden: true,
  },
  {
    idPrefix: 'glm-4.5',
    label: 'GLM-4.5',
    description: 'Prior-gen GLM-4.5 model with 96K context/output. Interleaved thinking.',
    contextWindow: 98304,
    interfaces: _IF_Reasoning,
    maxCompletionTokens: 98304,
    parameterSpecs: _PS_Reasoning,
    chatPrice: { input: 0.6, output: 2.2, cache: { cType: 'oai-ac', read: 0.11 } },
    initialTemperature: 0.6,
  },

  // GLM-4 Special Models (no thinking support)
  {
    idPrefix: 'glm-4-32b-0414-128k',
    label: 'GLM-4 32B (0414) 128K',
    description: 'GLM-4 32B model with 128K context, 16K output.',
    contextWindow: 131072,
    interfaces: _IF_Chat,
    maxCompletionTokens: 16384,
    chatPrice: { input: 0.1, output: 0.1 },
    initialTemperature: 0.75,
    hidden: true,
  },

];


/// Curated model IDs - authoritative list of Z.ai models
/// This is the primary source; the list API is unreliable.
const _zaiCuratedModelIds: string[] = [
  // Text: GLM-5 series
  'glm-5', 'glm-5-code',
  // Text: GLM-4.7 series
  'glm-4.7', 'glm-4.7-flash', 'glm-4.7-flashx',
  // Vision: GLM-4.6V series
  'glm-4.6v', 'glm-4.6v-flash', 'glm-4.6v-flashx',
  // Text: GLM-4.6
  'glm-4.6',
  // Vision: GLM-OCR, GLM-4.5V
  'glm-ocr', 'glm-4.5v',
  // Text: GLM-4.5 series
  'glm-4.5', 'glm-4.5-air', 'glm-4.5-x', 'glm-4.5-airx', 'glm-4.5-flash',
  // Text: GLM-4 special
  'glm-4-32b-0414-128k',
];


/**
 * Returns curated model descriptions - the primary source of truth for Z.ai models.
 * The list API is unreliable/abandoned, so this is always the base.
 */
export function zaiCuratedModelDescriptions(): ModelDescriptionSchema[] {
  return _zaiCuratedModelIds.map(id => _zaiModelToDescription(id));
}

/**
 * Given API-returned model IDs, discovers any models not in our curated list
 * and creates synthetic (hidden) descriptions for them.
 */
export function zaiDiscoverModels(apiModelIds: string[]): ModelDescriptionSchema[] {
  const curatedSet = new Set(_zaiCuratedModelIds);
  return apiModelIds
    .filter(id => !curatedSet.has(id))
    .map(id => _zaiModelToDescription(id));
}

export function zaiModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema) {
  // sort by the order in the known models list
  const aIndex = _knownZAIModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownZAIModels.findIndex(m => b.id.startsWith(m.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  // known models before unknown
  if (aIndex !== -1) return -1;
  if (bIndex !== -1) return 1;
  return a.id.localeCompare(b.id);
}


// internal: create a ModelDescriptionSchema from a model ID, using manual mappings with fallback
function _zaiModelToDescription(zaiModelId: string): ModelDescriptionSchema {
  return fromManualMapping(_knownZAIModels, zaiModelId, undefined, undefined, {
    idPrefix: zaiModelId,
    label: zaiModelId.replaceAll(/[_-]/g, ' '),
    description: 'New Z.ai Model',
    contextWindow: 128000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}
