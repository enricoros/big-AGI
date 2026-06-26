import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { type KnownLink, type KnownModel, formatPubDate, fromManualMapping, llmDevCheckModels_DEV, llmsDefineModels } from '../../models.mappings';

// --- Groq Model ID inference (auto-derived from _knownGroqModels) ---
export type LlmsGroqModelId = typeof _knownGroqModels[number]['idPrefix'];
import { wireGroqModelsListOutputSchema } from '../wiretypes/groq.wiretypes';


// dev options
const DEV_DEBUG_GROQ_MODELS = Release.IsNodeDevBuild; // not in staging to reduce noise


/**
 * Groq models.
 * - models list: https://console.groq.com/docs/models
 * - pricing: https://groq.com/pricing/
 * - updated: 2026-06-26
 */
type _GroqModelDef = (KnownModel & { pubDate: string }) | KnownLink;

const _knownGroqModels = llmsDefineModels<_GroqModelDef>()([

  // Preview Models
  {
    isPreview: true,
    idPrefix: 'meta-llama/llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout · 17B × 16E (Preview)',
    pubDate: '20250405',
    description: 'Llama 4 Scout 17B MoE with 16 experts (109B total params), native multimodal with vision support. 131K context, 8K max output. ~750 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.11, output: 0.34 },
  },
  {
    isPreview: true,
    idPrefix: 'qwen/qwen3-32b',
    label: 'Qwen 3 · 32B (Preview)',
    pubDate: '20250428',
    description: 'Qwen3 32B by Alibaba Cloud. Supports thinking/non-thinking modes, 100+ languages. 131K context, 40K max output. ~400 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 40960,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.29, output: 0.59 },
  },
  {
    isPreview: true,
    idPrefix: 'qwen/qwen3.6-27b',
    label: 'Qwen 3.6 · 27B (Preview)',
    pubDate: '20260509', // from API 'created' (no editorial date available)
    description: 'Qwen3.6 27B by Alibaba Cloud. Multimodal (vision + text), flagship-level agentic coding, thinking/non-thinking modes, tool use. 131K context, 32K max output. ~500 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.60, output: 3.00 },
  },

  // REMOVED MODELS (no longer returned by API):
  // - (Jan 21, 2026) qwen-qwq-32b, qwen-2.5-32b, qwen-2.5-coder-32b
  // - (Jan 21, 2026) deepseek-r1-distill-llama-70b, deepseek-r1-distill-qwen-32b
  // - (Feb 18, 2026) moonshotai/kimi-k2-instruct (deprecated redirect, removed from docs; still returned by API -> symlink above)
  // - (Apr 02, 2026) meta-llama/llama-4-maverick-17b-128e-instruct (removed from docs and pricing)
  // - (Jun 26, 2026) moonshotai/kimi-k2-instruct-0905 + moonshotai/kimi-k2-instruct (both removed from docs AND API)


  // Production Models - Compound Systems (pass-through pricing to underlying models)
  {
    idPrefix: 'groq/compound',
    label: 'Compound (Agentic System)',
    pubDate: '20250904',
    description: 'Groq agentic AI with web search, code execution, browser automation. Uses GPT-OSS 120B, Llama 4 Scout, Llama 3.3 70B. Pricing based on underlying model usage.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pass-through pricing
  },
  {
    idPrefix: 'groq/compound-mini',
    label: 'Compound Mini (Agentic System)',
    pubDate: '20250904',
    description: 'Lighter Groq agentic AI with web search, code execution. Pricing based on underlying model usage.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pass-through pricing
  },

  // Production Models - OpenAI GPT-OSS
  {
    idPrefix: 'openai/gpt-oss-120b',
    label: 'GPT OSS 120B',
    pubDate: '20250805',
    description: 'OpenAI flagship open-weight MoE (120B total, 5.1B active). Reasoning, browser search, code execution. 131K context, 65K max output. ~500 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.15, output: 0.60, cache: { cType: 'oai-ac', read: 0.075 } },
  },
  {
    isPreview: true,
    idPrefix: 'openai/gpt-oss-safeguard-20b',
    label: 'GPT OSS Safeguard 20B (Preview)',
    pubDate: '20251029',
    description: 'OpenAI safety classification model (20B MoE). Purpose-built for content moderation with Harmony response format. 131K context, 65K max output. ~1000 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.075, output: 0.30 },
  },
  {
    idPrefix: 'openai/gpt-oss-20b',
    label: 'GPT OSS 20B',
    pubDate: '20250805',
    description: 'OpenAI efficient open-weight MoE (20B total, 3.6B active). Tool use, browser search, code execution. 131K context, 65K max output. ~1000 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.075, output: 0.30, cache: { cType: 'oai-ac', read: 0.0375 } },
  },

  // Production Models - Meta
  // (Feb 18, 2026) meta-llama/llama-guard-4-12b removed from docs
  {
    idPrefix: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 · 70B Versatile',
    pubDate: '20241206',
    description: 'Meta Llama 3.3 (70B params) with GQA. Strong reasoning, coding, multilingual. 131K context, 32K max output. ~280 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.59, output: 0.79 },
  },
  {
    idPrefix: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 · 8B Instant',
    pubDate: '20240723',
    description: 'Meta Llama 3.1 (8B params). Fast, cost-effective for high-volume tasks. 131K context and max output. ~560 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.05, output: 0.08 },
  },

  // (Feb 18, 2026) allam-2-7b (SDAIA) removed from docs and pricing, still returned by API -> deny list

]);


const groqDenyList: string[] = [
  'whisper-',
  'distil-whisper',
  'playai-tts',
  'canopylabs/orpheus', // TTS models
  'llama-prompt-guard', // Text classification models
  'allam-2-7b', // SDAIA model, removed from docs and pricing (Feb 2026), API still returns it
];

export function groqModelFilter(model: { id: string }): boolean {
  return !groqDenyList.some(prefix => model.id.includes(prefix));
}

export function groqModelToModelDescription(_model: unknown): ModelDescriptionSchema {
  const model = wireGroqModelsListOutputSchema.parse(_model);

  // warn if the context window parsed is different than the mapped
  const knownModel = _knownGroqModels.find(base => model.id.startsWith(base.idPrefix));
  if (!knownModel)
    console.log(`groq.models: unknown model ${model.id}`, model);
  if (knownModel && model.context_window !== knownModel.contextWindow)
    console.warn(`groq.models: context window mismatch for ${model.id}: expected ${model.context_window} !== ${knownModel.contextWindow}`);
  if (knownModel?.maxCompletionTokens && model.max_completion_tokens !== knownModel.maxCompletionTokens)
    console.warn(`groq.models: max completion tokens mismatch for ${model.id}: expected ${model.max_completion_tokens} !== ${knownModel.maxCompletionTokens}`);

  const description = fromManualMapping(_knownGroqModels, model.id, model.created, undefined, {
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'New Model',
    contextWindow: model.context_window || 32768,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });

  // pubDate fallback: Groq's 'created' is verified real per-model dates (16/17 unique, 2023-2026 spread),
  // so derive a day-precision pubDate to drive the "new" badge for models without an editorial pubDate.
  // An editorial pubDate (from _knownGroqModels) always wins.
  if (description.pubDate === undefined && description.created)
    description.pubDate = formatPubDate(description.created);

  // prepend [model.owned_by] to the label
  if (model?.owned_by?.length)
    description.label = `[${model.owned_by}] ${description.label}`;

  return description;
}

export function groqValidateModelDefs_DEV(apiModelIds: string[]): void {
  if (DEV_DEBUG_GROQ_MODELS) {
    llmDevCheckModels_DEV('Groq', apiModelIds, _knownGroqModels.map(m => m.idPrefix), { checkUnknown: false });
  }
}


export function groqModelSortFn(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  // sort hidden at the end
  if (a.hidden && !b.hidden)
    return 1;
  if (!a.hidden && b.hidden)
    return -1;

  // sort as per their order in the known models
  const aIndex = _knownGroqModels.findIndex(base => a.id.startsWith(base.idPrefix));
  const bIndex = _knownGroqModels.findIndex(base => b.id.startsWith(base.idPrefix));
  if (aIndex !== -1 && bIndex !== -1)
    return aIndex - bIndex;

  return a.id.localeCompare(b.id);
}