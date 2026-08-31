import type { ModelDescriptionSchema } from '../../llm.server.types';
import { createVariantInjector, ModelVariantMap } from '../../llm.server.variants';
import { llmsDefineModels } from '../../models.mappings';

// --- Perplexity Model ID inference (auto-derived from _knownPerplexityChatModels) ---
export type LlmsPerplexityModelId = typeof _knownPerplexityChatModels[number]['id'];

import { LLM_IF_HOTFIX_NoStream, LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';


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
      LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision,
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


type _PerplexityModelDef = ModelDescriptionSchema & { pubDate: string };

// [Perplexity, 2026-08-17] Sonar Chat Completions is superseded by the Agent API (out of scope for this file): the 4 ids
// below are served until 2026-09-27, per the banner on every model page - https://docs.perplexity.ai/docs/sonar/models/sonar
// Migration map (https://docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview): sonar -> 'fast' preset,
// sonar-pro -> 'low', sonar-reasoning-pro -> 'medium', sonar-deep-research -> 'high'.
// Re-verified 2026-08-17 (live probes + https://docs.perplexity.ai/getting-started/pricing): ids, context windows and prices unchanged.
// Re-verified 2026-08-31 (schema enum + PRICING.sonar + live probe): same 4 ids, prices and the 2026-09-27 sunset unchanged; all Aug-2026 changelog entries are Agent API/Router only.

const _knownPerplexityChatModels = llmsDefineModels<_PerplexityModelDef>()([

  // Research Models
  {
    id: 'sonar-deep-research',
    label: 'Sonar Deep Research',
    pubDate: '20250214',
    description: 'Expert-level research model for exhaustive searches and comprehensive reports. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
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
    pubDate: '20250218',
    description: 'Premier reasoning model with enhanced multi-step Chain of Thought. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision],
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
    pubDate: '20250121',
    description: 'Advanced search model for complex queries and deep content understanding. 200k context.',
    contextWindow: 200000,
    maxCompletionTokens: 8000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
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
    pubDate: '20250121',
    description: 'Lightweight, cost-effective search model for quick, grounded answers. 128k context.',
    contextWindow: 128000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
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

]);


export function perplexityHardcodedModelDescriptions() {
  // Returns the list of known Perplexity models
  return _knownPerplexityChatModels;
}

export function perplexityInjectVariants(acc: ModelDescriptionSchema[], model: ModelDescriptionSchema): ModelDescriptionSchema[] {
  return createVariantInjector(_hardcodedPerplexityVariants, 'before')(acc, model);
}
