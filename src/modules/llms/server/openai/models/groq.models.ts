import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from '../../models.mappings';
import { wireGroqModelsListOutputSchema } from '../wiretypes/groq.wiretypes';


/**
 * Groq models.
 * - models list: https://console.groq.com/docs/models
 * - pricing: https://groq.com/pricing/
 * - updated: 2025-11-17
 */
const _knownGroqModels: ManualMappings = [

  // Preview Models
  {
    isPreview: true,
    idPrefix: 'meta-llama/llama-4-maverick-17b-128e-instruct',
    label: 'Llama 4 Maverick · 17B × 128E (Preview)',
    description: 'Llama 4 Maverick 17B with 128 experts, featuring a 131,072 token context window and up to 8,192 completion tokens. Preview model.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 0.60 },
  },
  {
    isPreview: true,
    idPrefix: 'meta-llama/llama-4-scout-17b-16e-instruct',
    label: 'Llama 4 Scout · 17B × 16E (Preview)',
    description: 'Llama 4 Scout 17B with 16 experts, featuring a 131,072 token context window and up to 8,192 completion tokens. Preview model.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.11, output: 0.34 },
  },
  {
    isPreview: true,
    idPrefix: 'qwen/qwen3-32b',
    label: 'Qwen 3 · 32B (Preview)',
    description: 'Qwen3 32B developed by Alibaba Cloud with a 131K token context window. Preview model.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.29, output: 0.59 },
  },
  {
    isPreview: true,
    idPrefix: 'moonshotai/kimi-k2-instruct-0905',
    label: 'Kimi K2 Instruct 0905 (Preview)',
    description: 'Kimi K2 Instruct 0905 1T model with a 262K token context window, up to 16,384 completion tokens. Preview model.',
    contextWindow: 262144,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1.00, output: 3.00 },
  },
  {
    idPrefix: 'moonshotai/kimi-k2-instruct',
    label: 'Kimi K2 Instruct (Deprecated)',
    description: 'Kimi K2 Instruct 1T model with a 131K token context window, up to 16,384 completion tokens. Deprecated - redirects to 0905 version. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 1.00, output: 3.00 },
    hidden: true, // Deprecated
  },


  // Production Models - Compound Systems
  {
    idPrefix: 'groq/compound',
    label: 'Compound (Production System)',
    description: 'Groq\'s agentic system with web search and code execution capabilities. 131,072 token context window, up to 8,192 completion tokens. Production system.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pricing unknown
  },
  {
    idPrefix: 'groq/compound-mini',
    label: 'Compound Mini (Production System)',
    description: 'Lighter version of Groq\'s agentic system with web search and code execution capabilities. 131,072 token context window, up to 8,192 completion tokens. Production system.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pricing unknown
  },

  // Production Models - OpenAI
  {
    idPrefix: 'openai/gpt-oss-120b',
    label: 'GPT OSS 120B',
    description: 'OpenAI GPT-OSS 120B with reasoning, browser search, and code execution capabilities. 131,072 token context window, up to 65,536 completion tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.15, output: 0.60 },
  },
  {
    idPrefix: 'openai/gpt-oss-safeguard-20b',
    label: 'GPT OSS Safeguard 20B',
    description: 'OpenAI GPT-OSS-Safeguard 20B specialized for safety classification and content moderation with reasoning, tool use, and browser search. 131,072 token context window, up to 65,536 completion tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.075, output: 0.30 },
  },
  {
    idPrefix: 'openai/gpt-oss-20b',
    label: 'GPT OSS 20B',
    description: 'OpenAI GPT-OSS 20B with a 131,072 token context window and up to 65,536 completion tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 65536,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.075, output: 0.30 },
  },

  // Production Models - SDAIA
  {
    idPrefix: 'allam-2-7b',
    label: 'ALLaM 2 · 7B',
    description: 'ALLaM 2 7B bilingual Arabic-English model developed by SDAIA with a 4,096 token context window. Production model.',
    contextWindow: 4096,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pricing pending
  },

  // Production Models - Meta
  {
    idPrefix: 'meta-llama/llama-guard-4-12b',
    label: 'Llama Guard 4 · 12B',
    description: 'Llama Guard 4 12B developed by Meta with a 131K token context window, up to 1,024 completion tokens. Natively multimodal safeguard for content moderation. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 1024,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 0.20 },
  },
  {
    idPrefix: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 · 70B Versatile',
    description: 'Llama 3.3 70B developed by Meta with a 131K token context window, up to 32,768 completion tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.59, output: 0.79 },
  },
  {
    idPrefix: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 · 8B Instant',
    description: 'Llama 3.1 8B developed by Meta with a 131K token context window, up to 131,072 completion tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.05, output: 0.08 },
  },

];


const groqDenyList: string[] = [
  'whisper-',
  'playai-tts',
  'distil-whisper',
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