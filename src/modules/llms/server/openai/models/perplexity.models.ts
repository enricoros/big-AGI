import type { ModelDescriptionSchema } from '../../llm.server.types';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';

const _knownPerplexityChatModels: ModelDescriptionSchema[] = [

  // Research Models
  {
    id: 'sonar-deep-research',
    label: 'Sonar Deep Research 🌐',
    description: 'Expert-level research model for exhaustive searches and comprehensive reports. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_Tools_WebSearch],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort', initialValue: 'medium' }, // REUSE!
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 2,
      output: 8,
      // Full pricing: $2/1M input, $8/1M output, $2/1M citation, $5/1k searches, $3/1M reasoning tokens
    },
  },

  // Reasoning Models
  {
    id: 'sonar-reasoning-pro',
    label: 'Sonar Reasoning Pro 🌐',
    description: 'Premier reasoning model (DeepSeek R1) with Chain of Thought. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_Tools_WebSearch],
    parameterSpecs: [
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 2,
      output: 8,
      // Per-request pricing: $14(High), $10(Medium), $6(Low) per 1k requests
    },
  },
  {
    id: 'sonar-reasoning',
    label: 'Sonar Reasoning 🌐',
    description: 'Fast, real-time reasoning model for quick problem-solving with search. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_Tools_WebSearch],
    parameterSpecs: [
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 1,
      output: 5,
      // Per-request pricing: $12(High), $8(Medium), $5(Low) per 1k requests
    },
  },

  // Search Models
  {
    id: 'sonar-pro',
    label: 'Sonar Pro 🌐',
    description: 'Advanced search model for complex queries and deep content understanding. 200k context.',
    contextWindow: 200000,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_Tools_WebSearch],
    parameterSpecs: [
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 3,
      output: 15,
      // Per-request pricing: $14(High), $10(Medium), $6(Low) per 1k requests
    },
  },
  {
    id: 'sonar',
    label: 'Sonar 🌐',
    description: 'Lightweight, cost-effective search model for quick, grounded answers. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_Tools_WebSearch],
    parameterSpecs: [
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 1,
      output: 1,
      // Per-request pricing: $12(High), $8(Medium), $5(Low) per 1k requests
    },
  },

  // Offline Models
  {
    id: 'r1-1776',
    label: 'R1-1776',
    description: 'Offline chat model (DeepSeek R1) for uncensored, unbiased, and factual information. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: {
      input: 2,
      output: 8,
      // No search cost
    },
  },

];

const perplexityAIModelFamilyOrder = [
  'sonar-deep-research',
  'sonar-reasoning-pro',
  'sonar-reasoning',
  'sonar-pro',
  'sonar',
  'r1-1776',
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
