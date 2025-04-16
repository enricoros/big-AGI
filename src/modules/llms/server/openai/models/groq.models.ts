import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from './models.data';
import { wireGroqModelsListOutputSchema } from '../groq.wiretypes';


/**
 * Groq models.
 * - models list: https://console.groq.com/docs/models
 * - pricing: https://groq.com/pricing/
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
    idPrefix: 'deepseek-r1-distill-llama-70b',
    label: 'DeepSeek R1 Distill Llama 70B (Preview)',
    description: 'DeepSeek R1 Distill Llama 70B with a context window of 128K tokens. Preview model.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.75, output: 0.99 },
  },
  {
    isPreview: true,
    idPrefix: 'qwen-qwq-32b',
    label: 'Qwen QwQ 32B (Preview)',
    description: 'Qwen QwQ 32B developed by Alibaba Cloud with a context window of 128K tokens. Preview model.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.29, output: 0.39 },
  },
  {
    isPreview: true,
    idPrefix: 'mistral-saba-24b',
    label: 'Mistral Saba 24B (Preview)',
    description: 'Mistral Saba 24B with a context window of 32K tokens. Preview model.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.79, output: 0.79 },
  },
  {
    isPreview: true,
    idPrefix: 'allam-2-7b',
    label: 'ALLaM 2 7B (Preview)',
    description: 'ALLaM 2 7B developed by Saudi Data and AI Authority (SDAIA) with a context window of 4,096 tokens. Preview model.',
    contextWindow: 4096,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pricing unknown
  },
  {
    isPreview: true,
    idPrefix: 'compound-beta',
    label: 'Compound Beta (Preview System)',
    description: 'Groq\'s agentic system with web search and code execution capabilities. Preview system with a context window of 128K tokens, up to 8,192 completion tokens.',
    contextWindow: 8192,
    // maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pricing unknown
  },
  {
    isPreview: true,
    idPrefix: 'compound-beta-mini',
    label: 'Compound Beta Mini (Preview System)',
    description: 'Lighter version of Groq\'s agentic system with web search and code execution capabilities. Preview system with a context window of 128K tokens, up to 8,192 completion tokens.',
    contextWindow: 8192,
    // maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // Pricing unknown
  },


  // Production Models
  {
    idPrefix: 'gemma2-9b-it',
    label: 'Gemma 2 · 9B Instruct',
    description: 'Gemma 2 9B developed by Google with a context window of 8,192 tokens. Production model.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 0.20 },
  },
  {
    idPrefix: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 · 70B Versatile',
    description: 'LLaMA 3.3 70B developed by Meta with a context window of 128K tokens, up to 32,768 completion tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.59, output: 0.79 },
  },
  {
    idPrefix: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 · 8B Instant',
    description: 'LLaMA 3.1 8B developed by Meta with a context window of 128K tokens, up to 8,192 completion tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.05, output: 0.08 },
  },
  {
    idPrefix: 'llama-guard-3-8b',
    label: 'Llama Guard 3 · 8B',
    description: 'LLaMA Guard 3 8B developed by Meta with a context window of 8,192 tokens. Production model.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.20, output: 0.20 },
  },
  {
    idPrefix: 'llama3-70b-8192',
    label: 'Llama 3 · 70B',
    description: 'LLaMA 3 70B developed by Meta with a context window of 8,192 tokens. Production model.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.59, output: 0.79 },
  },
  {
    idPrefix: 'llama3-8b-8192',
    label: 'Llama 3 · 8B',
    description: 'LLaMA 3 8B developed by Meta with a context window of 8,192 tokens. Production model.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.05, output: 0.08 },
  },

];


const groqDenyList: string[] = [
  'whisper-',
  'playai-tts',
  'distil-whisper',
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