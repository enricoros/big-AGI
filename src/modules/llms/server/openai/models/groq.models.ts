import { LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../../llm.server.types';
import { fromManualMapping, ManualMappings } from './models.data';
import { wireGroqModelsListOutputSchema } from '../groq.wiretypes';


/**
 * Groq models.
 * - models list: https://console.groq.com/docs/models
 * - pricing: https://groq.com/pricing/
 */
const _knownGroqModels: ManualMappings = [
  // Preview (recent)
  {
    isPreview: true,
    idPrefix: 'deepseek-r1-distill-llama-70b',
    label: 'DeepSeek R1 Distill Llama 70B (Preview)',
    description: 'DeepSeek R1 Distill Llama 70B with a context window of 131072 tokens. Preview model with tiered pricing up to 4K, 32K, and above 32K tokens.',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: {
      input: [{ upTo: 4000, price: 0.75 }, { upTo: 32000, price: 3.00 }, { upTo: null, price: 5.00 }],
      output: [{ upTo: 4000, price: 0.99 }, { upTo: 32000, price: 3.00 }, { upTo: null, price: 5.00 }],
    },
  },
  {
    isPreview: true,
    idPrefix: 'deepseek-r1-distill-qwen-32b',
    label: 'DeepSeek R1 Distill Qwen 32B (Preview)',
    description: 'DeepSeek R1 Distill Qwen 32B with a context window of 131,072 tokens, up to 16,384 completion tokens. Preview model.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.69, output: 0.69 },
  },
  {
    isPreview: true,
    idPrefix: 'qwen-2.5-32b',
    label: 'Qwen 2.5 · 32B (Preview)',
    description: 'Qwen 2.5 32B developed by Alibaba Cloud with a context window of 131,072 tokens. Preview model.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.79, output: 0.79 },
  },
  {
    isPreview: true,
    idPrefix: 'qwen-2.5-coder-32b',
    label: 'Qwen 2.5 Coder · 32B (Preview)',
    description: 'Qwen 2.5 32B developed by Alibaba Cloud with a context window of 131,072 tokens. Preview model.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.79, output: 0.79 },
  },
  {
    isPreview: true,
    idPrefix: 'deepseek-r1-distill-llama-70b-specdec',
    label: 'DeepSeek R1 Distill Llama 70B SpecDec (Preview)',
    description: 'DeepSeek R1 Distill Llama 70B SpecDec with a context window of 131,072 tokens, up to 16,384 completion tokens. Preview model.',
    contextWindow: 131072,
    maxCompletionTokens: 16384,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    hidden: true, // preview, and pricing unknown
  },

  // Production Models
  // ignoring (not chat models): distil-whisper-large-v3-en, whisper-large-v3, whisper-large-v3-turbo
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
    description: 'LLaMA 3.3 70B developed by Meta with a context window of 131,072 tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.59, output: 0.79 },
  },
  {
    idPrefix: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 · 8B Instant',
    description: 'LLaMA 3.1 8B developed by Meta with a context window of 131,072 tokens. Production model.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.05, output: 0.08 },
  },
  {
    idPrefix: 'llama-guard-3-8b',
    label: 'Llama Guard 3 · 8B',
    description: 'LLaMA Guard 3 8B developed by Meta with a context window of 8,192 tokens.',
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
  {
    idPrefix: 'mixtral-8x7b-32768',
    label: 'Mixtral 8x7B Instruct 32k',
    description: 'Mixtral 8x7B developed by Mistral with a context window of 32,768 tokens. Production model.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.24, output: 0.24 },
  },

  // Preview Models
  {
    isPreview: true,
    idPrefix: 'llama-3.3-70b-specdec',
    label: 'Llama 3.3 · 70B SpecDec (Faster, Preview)',
    description: 'LLaMA 3.3 70B SpecDec with a context window of 8,192 tokens. Preview model.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.59, output: 0.99 },
  },
  {
    isPreview: true,
    idPrefix: 'llama-3.2-1b-preview',
    label: 'Llama 3.2 · 1B (Preview)',
    description: 'LLaMA 3.2 1B with a context window of 131,072 tokens. Preview model.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.04, output: 0.04 },
  },
  {
    isPreview: true,
    idPrefix: 'llama-3.2-3b-preview',
    label: 'Llama 3.2 · 3B (Preview)',
    description: 'LLaMA 3.2 3B with a context window of 131,072 tokens. Preview model.',
    contextWindow: 131072,
    maxCompletionTokens: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    chatPrice: { input: 0.06, output: 0.06 },
  },
  {
    isPreview: true,
    idPrefix: 'llama-3.2-11b-vision-preview',
    label: 'Llama 3.2 · 11B Vision (Preview)',
    description: 'Vision model, 8,192 tokens context. Preview model.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.18, output: 0.18 },
  },
  {
    isPreview: true,
    idPrefix: 'llama-3.2-90b-vision-preview',
    label: 'Llama 3.2 · 90B Vision (Preview)',
    description: 'Vision model, 8,192 tokens context. Preview model.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 0.90, output: 0.90 },
  },
];


const groqDenyList: string[] = [
  'whisper-',
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

  return fromManualMapping(_knownGroqModels, model.id, model.created, undefined, {
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'New Model',
    contextWindow: model.context_window || 32768,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  });
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