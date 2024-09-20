import type { ModelDescriptionSchema } from '../../llm.server.types';

import { LLM_IF_OAI_Chat } from '~/common/stores/llms/llms.types';

const _knownPerplexityChatModels: ModelDescriptionSchema[] = [
  // Perplexity Sonar Online Models
  {
    id: 'llama-3.1-sonar-small-128k-online',
    label: 'Sonar Small Online 🌐',
    description: 'Llama 3.1 Sonar Small 128k Online',
    contextWindow: 127072,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.2, /* Price per 1M tokens in USD */ output: 0.2 /* Same as input *//* perRequest: 0.005, // $5 per 1000 requests = $0.005 per request */ },
  },
  {
    id: 'llama-3.1-sonar-large-128k-online',
    label: 'Sonar Large Online 🌐',
    description: 'Llama 3.1 Sonar Large 128k Online',
    contextWindow: 127072,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 1, output: 1/*perRequest: 0.005,*/ },
  },
  {
    id: 'llama-3.1-sonar-huge-128k-online',
    label: 'Sonar Huge Online 🌐',
    description: 'Llama 3.1 Sonar Huge 128k Online',
    contextWindow: 127072,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 5, output: 5/*perRequest: 0.005,*/ },
  },

  // Perplexity Sonar Chat Models
  {
    id: 'llama-3.1-sonar-small-128k-chat',
    label: 'Sonar Small Chat',
    description: 'Llama 3.1 Sonar Small 128k Chat',
    contextWindow: 127072,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.2, output: 0.2 },
  },
  {
    id: 'llama-3.1-sonar-large-128k-chat',
    label: 'Sonar Large Chat',
    description: 'Llama 3.1 Sonar Large 128k Chat',
    contextWindow: 127072,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 1, output: 1 },
  },

  // Open-Source Models
  {
    id: 'llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B Instruct',
    description: 'Llama 3.1 8B Instruct',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 0.2, output: 0.2 },
  },
  {
    id: 'llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B Instruct',
    description: 'Llama 3.1 70B Instruct',
    contextWindow: 131072,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 1, output: 1 },
  },
];

const perplexityAIModelFamilyOrder = [
  'llama-3.1-sonar-huge',
  'llama-3.1-sonar-large',
  'llama-3.1-sonar-small',
  'llama-3.1',
  '',
];

export function perplexityAIModelDescriptions() {
  // Returns the list of known Perplexity models
  return _knownPerplexityChatModels;
}

export function perplexityAIModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  const aPrefixIndex = perplexityAIModelFamilyOrder.findIndex((prefix) => a.id.startsWith(prefix));
  const bPrefixIndex = perplexityAIModelFamilyOrder.findIndex((prefix) => b.id.startsWith(prefix));
  // Sort by family order
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1) {
    if (aPrefixIndex !== bPrefixIndex) return aPrefixIndex - bPrefixIndex;
  }
  // Then sort by label in reverse order
  return b.label.localeCompare(a.label);
}