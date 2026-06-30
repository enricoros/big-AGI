import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { type KnownLink, type KnownModel, formatPubDate, fromManualMapping, llmDevCheckModels_DEV, llmsDefineModels } from '../../models.mappings';


// --- Cerebras Model ID inference (auto-derived from _knownCerebrasModels) ---
export type LlmsCerebrasModelId = typeof _knownCerebrasModels[number]['idPrefix'];


// dev options
const DEV_DEBUG_CEREBRAS_MODELS = Release.IsNodeDevBuild; // not in staging to reduce noise


// shared interface bundles
const IF_CHAT_FN = [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn];


/**
 * Cerebras models - fast OpenAI-compatible inference (wafer-scale).
 * - models list: https://inference-docs.cerebras.ai/models/overview
 * - pricing: https://www.cerebras.ai/pricing
 * - updated: 2026-06-30
 *
 * NOTE: Cerebras' /v1/models is minimal (id/created/owned_by, no context_window/caps), so
 * context/capabilities/pricing come from this hardcoded table; unknown ids fall back tolerantly.
 * Llama/Qwen families are Dedicated-Endpoints only and not exposed on the public /v1/models.
 */
type _CerebrasModelDef = (KnownModel & { pubDate?: string }) | KnownLink;

const _knownCerebrasModels = llmsDefineModels<_CerebrasModelDef>()([

  // Gemma 4 31B - Cerebras' first multimodal model (~1,850 tok/s)
  {
    isPreview: true,
    idPrefix: 'gemma-4-31b',
    label: 'Gemma 4 31B (Preview)',
    pubDate: '20260630',
    description: 'Google Gemma 4 31B on Cerebras - first multimodal model on wafer-scale inference (~1,850 tok/s). Vision (base64 PNG/JPEG, max 5 images / 10MB), function calling, reasoning (off by default, enable via effort). 131K context (65K free tier), 40K max output.',
    contextWindow: 131072,
    maxCompletionTokens: 40960,
    interfaces: [...IF_CHAT_FN, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high'] }, // reasoning off by default
    ],
    chatPrice: { input: 0.99, output: 1.49 },
  },

  // OpenAI GPT-OSS 120B - flagship open-weight MoE (~3,000 tok/s)
  {
    idPrefix: 'gpt-oss-120b',
    label: 'GPT OSS 120B',
    pubDate: '20250805',
    description: 'OpenAI flagship open-weight MoE (120B total, 5.1B active) on Cerebras (~3,000 tok/s). Reasoning and function calling. 131K context, 65K max output. Free preview.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [...IF_CHAT_FN, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] },
    ],
    // chatPrice: free preview (no public per-token pricing)
  },

  // Z.ai GLM 4.7 - agentic coding, strong tool use (~1,000 tok/s)
  {
    isPreview: true,
    idPrefix: 'zai-glm-4.7',
    label: 'Z.ai GLM 4.7 (Preview)',
    description: 'Z.ai GLM 4.7 (355B) on Cerebras (~1,000 tok/s). Strong agentic coding, advanced reasoning, superior tool use. 131K context. Free preview.',
    contextWindow: 131072,
    maxCompletionTokens: 40960,
    interfaces: [...IF_CHAT_FN, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high'] },
    ],
    // chatPrice: free preview (no public per-token pricing)
  },

]);


export function cerebrasModelFilter(model: { id: string }): boolean {
  // public endpoints only expose chat models; nothing to deny yet
  return !!model.id;
}

export function cerebrasModelToModelDescription(model: { id: string, created?: number }): ModelDescriptionSchema {

  const description = fromManualMapping(_knownCerebrasModels, model.id, model.created, undefined, {
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'New Cerebras Model',
    contextWindow: 131072,
    maxCompletionTokens: 32768,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });

  // pubDate fallback: derive a day-precision pubDate from the API 'created' to drive the "new" badge.
  // An editorial pubDate (from _knownCerebrasModels) always wins.
  if (description.pubDate === undefined && description.created)
    description.pubDate = formatPubDate(description.created);

  return description;
}

export function cerebrasValidateModelDefs_DEV(apiModelIds: string[]): void {
  if (DEV_DEBUG_CEREBRAS_MODELS)
    llmDevCheckModels_DEV('Cerebras', apiModelIds, _knownCerebrasModels.map(m => m.idPrefix), { checkUnknown: false });
}

export function cerebrasModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort hidden at the end
  if (a.hidden && !b.hidden) return 1;
  if (!a.hidden && b.hidden) return -1;

  // sort as per their order in the known models
  const aIndex = _knownCerebrasModels.findIndex(base => a.id.startsWith(base.idPrefix));
  const bIndex = _knownCerebrasModels.findIndex(base => b.id.startsWith(base.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;

  return a.id.localeCompare(b.id);
}
