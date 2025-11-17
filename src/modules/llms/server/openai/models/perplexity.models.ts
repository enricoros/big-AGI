import type { ModelDescriptionSchema } from '../../llm.server.types';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_Tools_WebSearch } from '~/common/stores/llms/llms.types';


// configuration
const PERPLEXITY_ENABLE_VARIANTS = false; // enable variants for Perplexity models


const _knownPerplexityChatModels: ModelDescriptionSchema[] = [

  // Research Models
  {
    id: 'sonar-deep-research',
    label: 'Sonar Deep Research',
    description: 'Expert-level research model for exhaustive searches and comprehensive reports. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_Tools_WebSearch],
    parameterSpecs: [
      { paramId: 'llmVndOaiReasoningEffort' }, // REUSE!
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 2,
      output: 8,
      // Full pricing: $2/1M input, $8/1M output, $2/1M citations, $5/1k searches, $3/1M reasoning tokens
    },
  },

  // Reasoning Models
  {
    id: 'sonar-reasoning-pro',
    label: 'Sonar Reasoning Pro',
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
    label: 'Sonar Reasoning',
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
    label: 'Sonar Pro',
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
    label: 'Sonar',
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

  // Deprecated Models (removed August 2025)
  // {
  //   id: 'r1-1776',
  //   label: 'R1-1776',
  //   description: 'DEPRECATED: Removed August 2025. Use Sonar Reasoning Pro instead.',
  //   contextWindow: 128000,
  //   interfaces: [LLM_IF_OAI_Chat],
  //   chatPrice: {
  //     input: 2,
  //     output: 8,
  //   },
  // },

];

export function perplexityInjectVariants(models: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {

  // Variant: academic deep research
  if (PERPLEXITY_ENABLE_VARIANTS && model.id === 'sonar-deep-research') {
    models.push({
      ...model,
      idVariant: 'academic',
      label: 'Sonar Deep Research (Academic)',
      description: 'Expert-level research model with academic sources only. Searches scholarly databases, peer-reviewed papers, and academic publications. 128k context.',
      parameterSpecs: [
        // Fixed parameters for academic search
        { paramId: 'llmVndOaiWebSearchContext', initialValue: 'medium', hidden: true },
        { paramId: 'llmVndPerplexitySearchMode', initialValue: 'academic', hidden: true },
        { paramId: 'llmForceNoStream', initialValue: true, hidden: true },
        // Free parameters
        // { paramId: 'llmVndOaiReasoningEffort', initialValue: 'medium' },
        { paramId: 'llmVndPerplexityDateFilter' },
      ],
    } satisfies ModelDescriptionSchema);
  }

  // Add the base model
  models.push(model);

  return models;
}

export function perplexityHardcodedModelDescriptions() {
  // Returns the list of known Perplexity models
  return _knownPerplexityChatModels;
}
