import type { ModelDescriptionSchema } from '../../llm.server.types';

import { LLM_IF_OAI_Chat } from '~/common/stores/llms/llms.types';


const _knownPerplexityChatModels: ModelDescriptionSchema[] = [
  // Perplexity models
  {
    id: 'llama-3-sonar-small-32k-chat',
    label: 'Sonar Small Chat',
    description: 'Llama 3 Sonar Small 32k Chat',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'llama-3-sonar-small-32k-online',
    label: 'Sonar Small Online 🌐',
    description: 'Llama 3 Sonar Small 32k Online',
    contextWindow: 28000,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'llama-3-sonar-large-32k-chat',
    label: 'Sonar Large Chat',
    description: 'Llama 3 Sonar Large 32k Chat',
    contextWindow: 32768,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'llama-3-sonar-large-32k-online',
    label: 'Sonar Large Online 🌐',
    description: 'Llama 3 Sonar Large 32k Online',
    contextWindow: 28000,
    interfaces: [LLM_IF_OAI_Chat],
  },

  // Open models
  {
    id: 'llama-3-8b-instruct',
    label: 'Llama 3 8B Instruct',
    description: 'Llama 3 8B Instruct',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'llama-3-70b-instruct',
    label: 'Llama 3 70B Instruct',
    description: 'Llama 3 70B Instruct',
    contextWindow: 8192,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'mixtral-8x7b-instruct',
    label: 'Mixtral 8x7B Instruct',
    description: 'Mixtral 8x7B Instruct',
    contextWindow: 16384,
    interfaces: [LLM_IF_OAI_Chat],
  },
];
const perplexityAIModelFamilyOrder = [
  'llama-3-sonar-large', 'llama-3-sonar-small', 'llama-3', 'mixtral', '',
];

export function perplexityAIModelDescriptions() {
  // change this implementation once upstream implements some form of models listing
  return _knownPerplexityChatModels;
}

export function perplexityAIModelSort(a: ModelDescriptionSchema, b: ModelDescriptionSchema): number {
  const aPrefixIndex = perplexityAIModelFamilyOrder.findIndex(prefix => a.id.startsWith(prefix));
  const bPrefixIndex = perplexityAIModelFamilyOrder.findIndex(prefix => b.id.startsWith(prefix));
  // sort by family
  if (aPrefixIndex !== -1 && bPrefixIndex !== -1)
    if (aPrefixIndex !== bPrefixIndex)
      return aPrefixIndex - bPrefixIndex;
  // then by reverse label
  return b.label.localeCompare(a.label);
}
