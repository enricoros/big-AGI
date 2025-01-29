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
  {
    isLatest: true,
    idPrefix: 'llama-3.1-405b-reasoning',
    label: 'Llama 3.1 · 405B',
    description: 'LLaMA 3.1 405B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    isLatest: true,
    idPrefix: 'llama-3.1-70b-versatile',
    label: 'Llama 3.1 · 70B',
    description: 'LLaMA 3.1 70B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    isLatest: true,
    idPrefix: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 · 8B',
    description: 'LLaMA 3.1 8B developed by Meta with a context window of 131,072 tokens. Supports tool use.',
    contextWindow: 131072,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-groq-70b-8192-tool-use-preview',
    label: 'Llama 3 Groq · 70B Tool Use',
    description: 'LLaMA 3 70B Tool Use developed by Groq with a context window of 8,192 tokens. Optimized for tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-groq-8b-8192-tool-use-preview',
    label: 'Llama 3 Groq · 8B Tool Use',
    description: 'LLaMA 3 8B Tool Use developed by Groq with a context window of 8,192 tokens. Optimized for tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'llama3-70b-8192',
    label: 'Llama 3 · 70B',
    description: 'LLaMA3 70B developed by Meta with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    // isLegacy: true,
    hidden: true,
  },
  {
    idPrefix: 'llama3-8b-8192',
    label: 'Llama 3 · 8B',
    description: 'LLaMA3 8B developed by Meta with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
    // isLegacy: true,
    hidden: true,
  },
  {
    idPrefix: 'mixtral-8x7b-32768',
    label: 'Mixtral 8x7B',
    description: 'Mixtral 8x7B developed by Mistral with a context window of 32,768 tokens. Supports tool use.',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'gemma2-9b-it',
    label: 'Gemma 2 · 9B Instruct',
    description: 'Gemma 2 9B developed by Google with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn],
  },
  {
    idPrefix: 'gemma-7b-it',
    label: 'Gemma 1.1 · 7B Instruct',
    description: 'Gemma 7B developed by Google with a context window of 8,192 tokens. Supports tool use.',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
];

export function groqModelToModelDescription(_model: unknown): ModelDescriptionSchema {
  const model = wireGroqModelsListOutputSchema.parse(_model);
  return fromManualMapping(_knownGroqModels, model.id, model.created, undefined, {
    idPrefix: model.id,
    label: model.id.replaceAll(/[_-]/g, ' '),
    description: 'New Model',
    contextWindow: 32768,
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