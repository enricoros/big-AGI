import type { ModelDescriptionSchema } from '../../llm.server.types';
import { createVariantInjector, ModelVariantMap } from '../../llm.server.variants';

import { LLM_IF_HOTFIX_NoStream, LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning } from '~/common/stores/llms/llms.types';


// configuration
const PERPLEXITY_ENABLE_VARIANTS = false; // enable variants for Perplexity models


// Perplexity Model Variants (variants appear before base model)
const _hardcodedPerplexityVariants: ModelVariantMap = !PERPLEXITY_ENABLE_VARIANTS ? {} : {

  // Academic deep research variant
  'sonar-deep-research': {
    idVariant: 'academic',
    label: 'Sonar Deep Research (Academic)',
    description: 'Expert-level research model with academic sources only. Searches scholarly databases, peer-reviewed papers, and academic publications. 128k context.',
    interfaces: [
      LLM_IF_HOTFIX_NoStream, // seems to be required for medium/academic
      LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning,
    ],
    parameterSpecs: [
      // Fixed parameters for academic search
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'medium', hidden: true },
      { paramId: 'llmVndPerplexitySearchMode', initialValue: 'academic', hidden: true },
      // Free parameters
      // { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'], initialValue: 'medium' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
  },

};


const _knownPerplexityChatModels: ModelDescriptionSchema[] = [

  // Research Models
  {
    id: 'sonar-deep-research',
    label: 'Sonar Deep Research',
    description: 'Expert-level research model for exhaustive searches and comprehensive reports. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiEffort', enumValues: ['low', 'medium', 'high'] },
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 2,
      output: 8,
      // Additional: $2/1M citations, $5/1k searches, $3/1M reasoning tokens
    },
  },

  // Reasoning Models
  {
    id: 'sonar-reasoning-pro',
    label: 'Sonar Reasoning Pro',
    description: 'Premier reasoning model (DeepSeek R1) with Chain of Thought. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning],
    parameterSpecs: [
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 2,
      output: 8,
      // Additional per-request: $6(Low) - $14(High) per 1k requests by search context size
    },
  },

  // Search Models
  {
    id: 'sonar-pro',
    label: 'Sonar Pro',
    description: 'Advanced search model for complex queries and deep content understanding. 200k context.',
    contextWindow: 200000,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat],
    parameterSpecs: [
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 3,
      output: 15,
      // Additional per-request: $6(Low) - $14(High) per 1k requests by search context size
    },
  },
  {
    id: 'sonar',
    label: 'Sonar',
    description: 'Lightweight, cost-effective search model for quick, grounded answers. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat],
    parameterSpecs: [
      { paramId: 'llmVndOaiWebSearchContext', initialValue: 'low' }, // REUSE!
      { paramId: 'llmVndPerplexitySearchMode' },
      { paramId: 'llmVndPerplexityDateFilter' },
    ],
    chatPrice: {
      input: 1,
      output: 1,
      // Additional per-request: $5(Low) - $12(High) per 1k requests by search context size
    },
  },

  // Deprecated Models
  // - sonar-reasoning: Removed December 2025. Use Sonar Reasoning Pro instead.
  // - r1-1776: Removed August 2025. Use Sonar Reasoning Pro instead.
  // - llama-3.1-sonar-*-128k-online aliases: Removed February 2025.

];


export function perplexityHardcodedModelDescriptions() {
  // Returns the list of known Perplexity models
  return _knownPerplexityChatModels;
}

export function perplexityInjectVariants(acc: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {
  return createVariantInjector(_hardcodedPerplexityVariants, 'before')(acc, model);
}
