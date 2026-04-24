import { LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';

import { fromManualMapping, ManualMappings } from '../../models.mappings';


const IF_4 = [LLM_IF_HOTFIX_StripImages, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];

// [DeepSeek, 2026-04-23] V4 release - https://api-docs.deepseek.com/quick_start/pricing
// - Model IDs listed by /models: deepseek-v4-flash, deepseek-v4-pro
// - Legacy aliases still accepted: deepseek-chat -> v4-flash (thinking disabled), deepseek-reasoner -> v4-flash (thinking enabled)
// - Reasoning control: object `thinking: { type: 'enabled'|'disabled', reasoning_effort?: 'high'|'max' }`
//   (the live API also accepts type: 'adaptive', but it is undocumented and empirically behaves the same as 'enabled'
//    on current builds -- deliberately not exposed here; add it once docs + semantics stabilize)
// - V3.2 endpoints no longer accessible via direct model ID (API returns only v4-flash/v4-pro)
const _knownDeepseekChatModels: ManualMappings = [
  {
    idPrefix: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    description: 'Premium reasoning model with 1M context. Supports extended thinking modes, JSON output, and function calling.',
    contextWindow: 1_048_576, // 1M
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high', 'max'] },
    ],
    maxCompletionTokens: 65536, // conservative default; docs advertise up to 384K
    chatPrice: { input: 1.74, output: 3.48, cache: { cType: 'oai-ac', read: 0.145 } },
  },
  {
    idPrefix: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    description: 'Fast general-purpose model with 1M context. Supports extended thinking modes, JSON output, and function calling.',
    contextWindow: 1_048_576, // 1M
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndMiscEffort', enumValues: ['none', 'high', 'max'] },
    ],
    maxCompletionTokens: 65536, // conservative default; docs advertise up to 384K
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.028 } },
  },
  // Legacy aliases - API routes both to deepseek-v4-flash with thinking pre-set
  {
    idPrefix: 'deepseek-reasoner',
    label: 'DeepSeek Reasoner (legacy)',
    description: 'Legacy alias: routes to DeepSeek V4 Flash with thinking enabled.',
    contextWindow: 1_048_576,
    interfaces: [...IF_4, LLM_IF_OAI_Reasoning],
    maxCompletionTokens: 65536,
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.028 } },
    isLegacy: true,
  },
  {
    idPrefix: 'deepseek-chat',
    label: 'DeepSeek Chat (legacy)',
    description: 'Legacy alias: routes to DeepSeek V4 Flash with thinking disabled.',
    contextWindow: 1_048_576,
    interfaces: IF_4,
    maxCompletionTokens: 65536,
    chatPrice: { input: 0.14, output: 0.28, cache: { cType: 'oai-ac', read: 0.028 } },
    isLegacy: true,
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
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
}

export function deepseekModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema) {
  // sort by the order in the known models list
  const aIndex = _knownDeepseekChatModels.findIndex(m => a.id.startsWith(m.idPrefix));
  const bIndex = _knownDeepseekChatModels.findIndex(m => b.id.startsWith(m.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;
  return a.id.localeCompare(b.id);
}


// [DeepSeek, 2025-12-15] V3.2-Speciale endpoint has expired and been removed
// The temporary endpoint (v3.2_speciale_expires_on_20251215) was decommissioned on Dec 15, 2025 15:59 UTC
// To re-enable variants, use createVariantInjector() from llm.server.variants.ts
