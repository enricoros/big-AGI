import type { ModelDescriptionSchema } from '../../llm.server.types';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';

const _knownPerplexityChatModels: ModelDescriptionSchema[] = [

  // Current Perplexity Models
  {
    id: 'sonar-reasoning-pro',
    label: 'Sonar Reasoning Pro 🌐',
    description: 'Advanced reasoning model (128k) with 8k max output tokens and search subsystem',
    contextWindow: 128000,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning],
    chatPrice: {
      input: 2,
      output: 8,
      // Note: also has $5 per 1000 searches cost, but our pricing model doesn't support this yet
    },
  },
  {
    id: 'sonar-reasoning',
    label: 'Sonar Reasoning 🌐',
    description: 'Advanced reasoning model with 128k context window. Based on DeepSeek R1.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning],
    chatPrice: {
      input: 1,
      output: 5,
      // Note: also has $5 per 1000 searches cost, but our pricing model doesn't support this yet
    },
  },
  {
    id: 'sonar-pro',
    label: 'Sonar Pro 🌐',
    description: 'Advanced model with enhanced search capabilities and 200k context window',
    contextWindow: 200000,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: {
      input: 3,
      output: 15,
      // Note: also has $5 per 1000 searches cost, but our pricing model doesn't support this yet
    },
  },
  {
    id: 'sonar',
    label: 'Sonar 🌐',
    description: 'Base model with 128k context window',
    contextWindow: 128000,
    maxCompletionTokens: 4000,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: {
      input: 1,
      output: 1,
      // Note: also has $5 per 1000 searches cost, but our pricing model doesn't support this yet
    },
  },
  {
    id: 'r1-1776',
    label: 'R1-1776',
    description: 'Offline chat model with 128k context, does not use search subsystem',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: {
      input: 2,
      output: 8,
      // No search cost
    },
  },

  // Legacy Models (to be deprecated after 2/22/2025)
  {
    id: 'llama-3.1-sonar-small-128k-online',
    label: 'Sonar Small Online (Legacy)',
    description: 'Llama 3.1 Sonar Small 128k Online (Legacy, deprecated after 2/22/2025)',
    contextWindow: 127000,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: {
      input: 0.2,
      output: 0.2,
      // Note: also has $5 per 1000 requests cost
    },
    hidden: true,
  },
  {
    id: 'llama-3.1-sonar-large-128k-online',
    label: 'Sonar Large Online (Legacy)',
    description: 'Llama 3.1 Sonar Large 128k Online (Legacy, deprecated after 2/22/2025)',
    contextWindow: 127000,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: {
      input: 1,
      output: 1,
      // Note: also has $5 per 1000 requests cost
    },
    hidden: true,
  },
  {
    id: 'llama-3.1-sonar-huge-128k-online',
    label: 'Sonar Huge Online (Legacy)',
    description: 'Llama 3.1 Sonar Huge 128k Online (Legacy, deprecated after 2/22/2025)',
    contextWindow: 127000,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: {
      input: 5,
      output: 5,
      // Note: also has $5 per 1000 requests cost
    },
    hidden: true,
  },
];

const perplexityAIModelFamilyOrder = [
  'sonar-reasoning-pro',
  'sonar-reasoning',
  'sonar-pro',
  'sonar',
  'r1-1776',
  'llama-3.1-sonar-huge',
  'llama-3.1-sonar-large',
  'llama-3.1-sonar-small',
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
