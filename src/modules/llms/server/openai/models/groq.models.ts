import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from '../../models.mappings';
import { wireGroqModelsListOutputSchema } from '../wiretypes/groq.wiretypes';


/**
 * Groq models.
 * - models list: https://console.groq.com/docs/models
 * - pricing: https://groq.com/pricing/
 * - updated: 2026-01-14
 */
const _knownGroqModels: ManualMappings = [

  // Preview Models
  {
    isPreview: true,
    idPrefix: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    label: 'Llama 4 Maverick · 17B × 128E (Preview)',
    description: 'Llama 4 Maverick 17B MoE with 128 experts (400B total params), native multimodal with vision support. 131K context, 8K max output. ~600 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 0.60 },
  },
  {
    isPreview: true,
    idPrefix: 'meta-llama/llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout · 17B × 16E (Preview)',
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
    description: 'Qwen3 32B by Alibaba Cloud. Supports thinking/non-thinking modes, 100+ languages. 131K context, 40K max output. ~400 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 40960,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.29, output: 0.59 },
  },
  {
    isPreview: true,
    idPrefix: 'moonshotai/kimi-k2-instruct-0905',
    label: 'Kimi K2 Instruct 0905 (Preview)',
    description: 'Kimi K2 1T MoE model (32B active, 384 experts). Advanced agentic coding. 262K context, 16K max output. ~200 t/s on Groq.',
    contextWindow: 262144,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1.00, output: 3.00 },
  },
  {
    isLegacy: true,
    idPrefix: 'moonshotai/kimi-k2-instruct',
    label: 'Kimi K2 Instruct (Deprecated)',
    description: 'Deprecated on 2025-10-10, redirects to kimi-k2-instruct-0905.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1.00, output: 3.00 },
    hidden: true,
  },


  // Production Models - Compound Systems (pass-through pricing to underlying models)
  {
    idPrefix: 'groq/compound',
    label: 'Compound (Agentic System)',
    description: 'Groq agentic AI with web search, code execution, browser automation. Uses GPT-OSS 120B, Llama 4 Scout, Llama 3.3 70B. Pricing based on underlying model usage.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pass-through pricing
  },
  {
    idPrefix: 'groq/compound-mini',
    label: 'Compound Mini (Agentic System)',
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
    description: 'OpenAI flagship open-weight MoE (120B total, 5.1B active). Reasoning, browser search, code execution. 131K context, 65K max output. ~500 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.15, output: 0.60 },
  },
  {
    idPrefix: 'openai/gpt-oss-safeguard-20b',
    label: 'GPT OSS Safeguard 20B',
    description: 'OpenAI safety classification model (20B MoE). Purpose-built for content moderation with Harmony response format. 131K context, 65K max output. ~1000 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.075, output: 0.30 },
  },
  {
    idPrefix: 'openai/gpt-oss-20b',
    label: 'GPT OSS 20B',
    description: 'OpenAI efficient open-weight MoE (20B total, 3.6B active). Tool use, browser search, code execution. 131K context, 65K max output. ~1000 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.075, output: 0.30 },
  },

  // Production Models - SDAIA
  {
    idPrefix: 'allam-2-7b',
    label: 'ALLaM 2 · 7B',
    description: 'SDAIA bilingual Arabic-English model (7B params). Trained on 4T English + 1.2T Arabic/English tokens. 4K context. ~1800 t/s on Groq.',
    contextWindow: 4096,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pricing pending
  },

  // Production Models - Meta
  {
    idPrefix: 'meta-llama/llama-guard-4-12b',
    label: 'Llama Guard 4 · 12B',
    description: 'Meta multimodal content moderation (12B params). Classifies text and images. 131K context, 1K max output. ~1200 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 1024,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 0.20 },
  },
  {
    idPrefix: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 · 70B Versatile',
    description: 'Meta Llama 3.3 (70B params) with GQA. Strong reasoning, coding, multilingual. 131K context, 32K max output. ~280 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.59, output: 0.79 },
  },
  {
    idPrefix: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 · 8B Instant',
    description: 'Meta Llama 3.1 (8B params). Fast, cost-effective for high-volume tasks. 131K context and max output. ~560 t/s on Groq.',
    contextWindow: 131072,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.05, output: 0.08 },
  },

];


const groqDenyList: string[] = [
  'whisper-',
  'distil-whisper',
  'playai-tts',
  'canopylabs/orpheus', // TTS models
  'llama-prompt-guard', // Text classification models
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

  // prepend [model.owned_by] to the label
  if (model?.owned_by?.length)
    description.label = `[${model.owned_by}] ${description.label}`;

  return description;
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