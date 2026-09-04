import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';
import { Release } from '~/common/app.release';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { type KnownLink, type KnownModel, formatPubDate, fromManualMapping, llmDevCheckModels_DEV, llmsDefineModels, llmsLabelUncurated } from '../../models.mappings';

// --- Groq Model ID inference (auto-derived from _knownGroqModels) ---
export type LlmsGroqModelId = typeof _knownGroqModels[number]['idPrefix'];
import { wireGroqModelsListOutputSchema } from '../wiretypes/groq.wiretypes';


// dev options
const DEV_DEBUG_GROQ_MODELS = Release.IsNodeDevBuild; // not in staging to reduce noise


/**
 * Groq models.
 * - models list: https://console.groq.com/docs/models
 * - pricing: the per-model card PRICING block, e.g. https://console.groq.com/docs/model/openai/gpt-oss-120b (groq.com/pricing is JS-rendered, no table)
 * - deprecations (shutdown dates + replacements): https://console.groq.com/docs/deprecations
 * - updated: 2026-08-31
 */
type _GroqModelDef = (KnownModel & { pubDate: string }) | KnownLink;

const _knownGroqModels = llmsDefineModels<_GroqModelDef>()([

  // Preview Models
  {
    isPreview: true,
    idPrefix: 'qwen/qwen3.8-27b',
    label: 'Qwen 3.8 · 27B (Preview)',
    pubDate: '20260805', // upstream Qwen3.8-27B weights release (HF repo createdAt 2026-08-05), not the Groq listing date (20260817)
    description: 'Qwen3.8 27B by Alibaba Cloud. Multimodal (vision + text, max 3 images / 20MB), frontier-level agentic coding for its size, thinking/instruct modes, tool use. 131K context, 16K max output. ~450 t/s on Groq.',
    contextWindow: 131042, // odd but real: the list API and the model card agree
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none', 'low', 'medium', 'high'] }, // full ladder per docs/reasoning + live-accepted (unlike 3.6's none-only)
    ],
    chatPrice: { input: 0.80, output: 4.00 }, // no cache: prompt caching stays gpt-oss-only (docs/prompt-caching)
  },
  {
    isPreview: true,
    idPrefix: 'qwen/qwen3.6-27b',
    label: 'Qwen 3.6 · 27B (Preview)',
    pubDate: '20260421', // upstream Qwen3.6-27B weights release (HF repo createdAt 2026-04-21; announced Apr 22), not the Groq listing date (20260509)
    description: 'Qwen3.6 27B by Alibaba Cloud. Multimodal (vision + text, max 3 images / 20MB), flagship-level agentic coding, thinking/non-thinking modes, tool use. 131K context, 16K max output. ~500 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['none'] }, // Groq accepts only none|default here; unset = default = thinking on
    ],
    chatPrice: { input: 0.60, output: 3.00 }, // no cache: prompt caching is gpt-oss-only, despite the list API advertising an input_cache_read rate here
  },
  {
    isPreview: true,
    idPrefix: 'minimaxai/minimax-m2.7',
    label: 'MiniMax M2.7 (Preview)',
    pubDate: '20260318', // upstream MiniMax M2.7 API launch (as in minimax.models.ts); the HF weights followed on 20260409
    description: 'MiniMax M2.7 MoE (229B total, ~10B active). Interleaved thinking for agentic workflows, tool use, coding. 196K context, 131K max output. ~260 t/s on Groq. Enterprise-only: pricing on request.',
    contextWindow: 196608,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1416 }, // lmarena: minimax-m2.7
    // Enterprise-only on Groq (contact sales): standard API keys 404 it, so the DEV stale check will flag it
  },

  // REMOVED MODELS (no longer returned by API):
  // - (Jan 21, 2026) qwen-qwq-32b, qwen-2.5-32b, qwen-2.5-coder-32b
  // - (Jan 21, 2026) deepseek-r1-distill-llama-70b, deepseek-r1-distill-qwen-32b
  // - (Feb 18, 2026) moonshotai/kimi-k2-instruct (deprecated redirect, removed from docs; still returned by API -> symlink above)
  // - (Feb 18, 2026) meta-llama/llama-guard-4-12b (removed from docs; shut down Mar 05 -> gpt-oss-safeguard-20b)
  // - (Apr 02, 2026) meta-llama/llama-4-maverick-17b-128e-instruct (removed from docs and pricing)
  // - (Jun 26, 2026) moonshotai/kimi-k2-instruct-0905 + moonshotai/kimi-k2-instruct (both removed from docs AND API)
  // - (Jul 17, 2026) qwen/qwen3-32b, meta-llama/llama-4-scout-17b-16e-instruct (announced Jun 17, shut down Jul 17 -> gpt-oss-120b / qwen3.6-27b)
  // - (Aug 16, 2026) llama-3.3-70b-versatile, llama-3.1-8b-instant (announced Jun 17, shut down Aug 16 -> gpt-oss-120b or qwen3.6-27b / gpt-oss-20b);
  //   llama-3.3-70b-versatile still powers groq/compound-mini internally (docs/compound/systems/compound-mini); the shutdown applies to free/developer tiers only (enterprise committed-spend contracts unaffected)


  // Production Models - Compound Systems (pass-through pricing to underlying models)
  {
    idPrefix: 'groq/compound',
    label: 'Compound (Agentic System)',
    pubDate: '20250904',
    description: 'Groq agentic AI with web search, visit website, code execution, Wolfram Alpha. Uses GPT-OSS 120B, Llama 4 Scout, Llama 3.3 70B. Pricing based on underlying model usage.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pass-through pricing
  },
  {
    idPrefix: 'groq/compound-mini',
    label: 'Compound Mini (Agentic System)',
    pubDate: '20250904',
    description: 'Lighter Groq agentic AI, same built-in tools but a single tool call per request (~3x lower latency). Pricing based on underlying model usage.',
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
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }, // Groq rejects 'none' on gpt-oss
    ],
    chatPrice: { input: 0.15, output: 0.60, cache: { read: 0.075 } },
    benchmark: { cbaElo: 1352 }, // lmarena: gpt-oss-120b
  },
  {
    isPreview: true,
    idPrefix: 'openai/gpt-oss-safeguard-20b',
    label: 'GPT OSS Safeguard 20B (Preview)',
    pubDate: '20251029',
    description: 'OpenAI safety classification model (20B MoE). Purpose-built for content moderation with Harmony response format. 131K context, 65K max output. ~1000 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }, // Groq rejects 'none' on gpt-oss
    ],
    chatPrice: { input: 0.075, output: 0.30, cache: { read: 0.0375 } },
  },
  {
    idPrefix: 'openai/gpt-oss-20b',
    label: 'GPT OSS 20B',
    pubDate: '20250805',
    description: 'OpenAI efficient open-weight MoE (20B total, 3.6B active). Tool use, browser search, code execution. 131K context, 65K max output. ~1000 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] }, // Groq rejects 'none' on gpt-oss
    ],
    chatPrice: { input: 0.075, output: 0.30, cache: { read: 0.0375 } },
    benchmark: { cbaElo: 1318 }, // lmarena: gpt-oss-20b
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
    label: llmsLabelUncurated(model.id.replaceAll(/[_-]/g, ' ')),
    description: 'New Groq arrival, not yet curated - capabilities unverified.',
    contextWindow: model.context_window || null, // API value when present; null (not a guess) otherwise
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
    llmDevCheckModels_DEV('Groq', apiModelIds, _knownGroqModels.map(m => m.idPrefix), {
      checkUnknown: false,
      ignoreStale: ['minimaxai/minimax-m2.7'], // enterprise-only, never lists for standard keys
    });
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