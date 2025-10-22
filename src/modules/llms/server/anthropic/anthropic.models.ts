import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../llm.server.types';


const ANT_PAR_WEB: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndAntWebSearch' },
  { paramId: 'llmVndAntWebFetch' },
] as const;

const ANT_PAR_WEB_THINKING: ModelDescriptionSchema['parameterSpecs'] = [
  { paramId: 'llmVndAntThinkingBudget', required: true, hidden: false },
  ...ANT_PAR_WEB,
] as const;


export const hardcodedAnthropicVariants: { [modelId: string]: Partial<ModelDescriptionSchema> } = {

  // NOTE: what's not redefined below is inherited from the underlying model definition

  // Claude 4.5 models with thinking variants
  'claude-sonnet-4-5-20250929': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 4.5 (Thinking)',
    description: 'Claude Sonnet 4.5 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: [...ANT_PAR_WEB_THINKING, { paramId: 'llmVndAnt1MContext' }],
    maxCompletionTokens: 64000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1451 + 1 }, // FALLBACK-UNTIL-AVAILABLE: claude-opus-4-1-20250805-thinking-16k + 1
  },

  'claude-haiku-4-5-20251001': {
    idVariant: 'thinking',
    label: 'Claude Haiku 4.5 (Thinking)',
    description: 'Claude Haiku 4.5 with extended thinking mode - first Haiku model with reasoning capabilities',
    parameterSpecs: ANT_PAR_WEB_THINKING,
    maxCompletionTokens: 64000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
  },

  // Claude 4.1 models with thinking variants
  'claude-opus-4-1-20250805': {
    idVariant: 'thinking',
    label: 'Claude Opus 4.1 (Thinking)',
    description: 'Claude Opus 4.1 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: ANT_PAR_WEB_THINKING,
    maxCompletionTokens: 32000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1451 }, // claude-opus-4-1-20250805-thinking-16k
  },

  // Claude 4 models with thinking variants
  'claude-opus-4-20250514': {
    hidden: true, // superseded by 4.1
    idVariant: 'thinking',
    label: 'Claude Opus 4 (Thinking)',
    description: 'Claude Opus 4 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: ANT_PAR_WEB_THINKING,
    maxCompletionTokens: 32000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1420 }, // claude-opus-4-20250514-thinking-16k
  },

  'claude-sonnet-4-20250514': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 4 (Thinking)',
    description: 'Claude Sonnet 4 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: [...ANT_PAR_WEB_THINKING, { paramId: 'llmVndAnt1MContext' }],
    maxCompletionTokens: 64000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1400 }, // claude-sonnet-4-20250514-thinking-32k
  },

  // Changes to the thinking variant (same model ID) for the Claude Sonnet 3.7 model
  'claude-3-7-sonnet-20250219': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 3.7 (Thinking)',
    description: 'Claude 3.7 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: ANT_PAR_WEB_THINKING,
    maxCompletionTokens: 64000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1385 }, // claude-3-7-sonnet-20250219-thinking-32k
  },

} as const;


export const hardcodedAnthropicModels: (ModelDescriptionSchema & { isLegacy?: boolean })[] = [

  // Claude 4.5 models
  {
    id: 'claude-sonnet-4-5-20250929', // Active
    label: 'Claude Sonnet 4.5', // 🌟
    description: 'Best model for complex agents and coding, with the highest intelligence across most tasks',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    trainingDataCutoff: 'Jul 2025',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    parameterSpecs: [...ANT_PAR_WEB, { paramId: 'llmVndAnt1MContext' }],
    // Note: Tiered pricing - ≤200K: $3/$15, >200K: $6/$22.50 (with 1M context enabled)
    // Cache pricing also tiered: write 1.25× input, read 0.10× input
    chatPrice: {
      input: [{ upTo: 200000, price: 3 }, { upTo: null, price: 6 }],
      output: [{ upTo: 200000, price: 15 }, { upTo: null, price: 22.50 }],
      cache: {
        cType: 'ant-bp',
        read: [{ upTo: 200000, price: 0.30 }, { upTo: null, price: 0.60 }],
        write: [{ upTo: 200000, price: 3.75 }, { upTo: null, price: 7.50 }],
        duration: 300
      },
    },
    benchmark: { cbaElo: 1438 + 1 }, // FALLBACK-UNTIL-AVAILABLE: claude-opus-4-1-20250805 + 1
  },
  {
    id: 'claude-haiku-4-5-20251001', // Active
    label: 'Claude Haiku 4.5', // 🌟
    description: 'Fastest model with exceptional speed and performance',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    trainingDataCutoff: 'Jul 2025',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    parameterSpecs: ANT_PAR_WEB,
    chatPrice: { input: 1, output: 5, cache: { cType: 'ant-bp', read: 0.10, write: 1.25, duration: 300 } },
  },

  // Claude 4.1 models
  {
    id: 'claude-opus-4-1-20250805', // Active
    label: 'Claude Opus 4.1', // 🌟
    description: 'Exceptional model for specialized complex tasks requiring advanced reasoning',
    contextWindow: 200000,
    maxCompletionTokens: 32000,
    trainingDataCutoff: 'Mar 2025',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    parameterSpecs: ANT_PAR_WEB,
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1438 }, // claude-opus-4-1-20250805
  },

  // Claude 4 models
  {
    hidden: true, // superseded by 4.1
    id: 'claude-opus-4-20250514', // Active
    label: 'Claude Opus 4',
    description: 'Previous flagship model',
    contextWindow: 200000,
    maxCompletionTokens: 32000,
    trainingDataCutoff: 'Mar 2025',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    parameterSpecs: ANT_PAR_WEB,
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1411 }, // claude-opus-4-20250514
  },
  {
    id: 'claude-sonnet-4-20250514', // Active
    label: 'Claude Sonnet 4', // 🌟
    description: 'High-performance model',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    trainingDataCutoff: 'Mar 2025',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    parameterSpecs: [...ANT_PAR_WEB, { paramId: 'llmVndAnt1MContext' }],
    // Note: Tiered pricing - ≤200K: $3/$15, >200K: $6/$22.50 (with 1M context enabled)
    // Cache pricing also tiered: write 1.25× input, read 0.10× input
    chatPrice: {
      input: [{ upTo: 200000, price: 3 }, { upTo: null, price: 6 }],
      output: [{ upTo: 200000, price: 15 }, { upTo: null, price: 22.50 }],
      cache: {
        cType: 'ant-bp',
        read: [{ upTo: 200000, price: 0.30 }, { upTo: null, price: 0.60 }],
        write: [{ upTo: 200000, price: 3.75 }, { upTo: null, price: 7.50 }],
        duration: 300
      },
    },
    benchmark: { cbaElo: 1386 }, // claude-sonnet-4-20250514
  },

  // Claude 3.7 models
  {
    id: 'claude-3-7-sonnet-20250219', // Active | Guaranteed Until: February 2026
    label: 'Claude Sonnet 3.7',
    description: 'High-performance model with early extended thinking',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    trainingDataCutoff: 'Nov 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    parameterSpecs: ANT_PAR_WEB,
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1369 }, // claude-3-7-sonnet-20250219
  },

  // Claude 3.5 models
  {
    id: 'claude-3-5-sonnet-20241022', // Deprecated | Deprecated: August 13, 2025 | Retiring: October 22, 2025
    label: 'Claude Sonnet 3.5 [Deprecated]',
    description: 'High level of intelligence and capability. Deprecated August 13, 2025, retiring October 22, 2025.',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Jul 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1368, cbaMmlu: 88.7 }, // Claude 3.5 Sonnet (10/22)
    hidden: true, // deprecated
    isLegacy: true,
  },
  {
    id: 'claude-3-5-sonnet-20240620', // Deprecated | Deprecated: August 13, 2025 | Retiring: October 22, 2025
    label: 'Claude Sonnet 3.5 (previous) [Deprecated]',
    description: 'Previous version of Claude Sonnet 3.5. Deprecated August 13, 2025, retiring October 22, 2025.',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1340, cbaMmlu: 88.6 },
    hidden: true,
    isLegacy: true,
  },
  {
    id: 'claude-3-5-haiku-20241022', // Active | Guaranteed Until: October 2025
    label: 'Claude Haiku 3.5',
    description: 'Intelligence at blazing speeds',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Jul 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    parameterSpecs: ANT_PAR_WEB,
    chatPrice: { input: 0.80, output: 4.00, cache: { cType: 'ant-bp', read: 0.08, write: 1.00, duration: 300 } },
    benchmark: { cbaElo: 1319, cbaMmlu: 75.2 }, // claude-3-5-haiku-20241022
  },

  // Claude 3 models
  {
    id: 'claude-3-opus-20240229', // Deprecated | Deprecated: June 30, 2025 | Retiring: January 5, 2026
    label: 'Claude Opus 3 [Deprecated]',
    description: 'Powerful model for complex tasks. Deprecated June 30, 2025, retiring January 5, 2026.',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1322, cbaMmlu: 86.8 },
    hidden: true, // deprecated
    isLegacy: true,
  },
  {
    id: 'claude-3-haiku-20240307', // Active
    label: 'Claude Haiku 3',
    description: 'Fast and compact model for near-instant responsiveness',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 0.25, output: 1.25, cache: { cType: 'ant-bp', read: 0.03, write: 0.30, duration: 300 } },
    benchmark: { cbaElo: 1263, cbaMmlu: 75.1 },
  },

  // Legacy/Retired models
  {
    id: 'claude-3-sonnet-20240229', // Retired | Retired: July 21, 2025
    label: 'Claude Sonnet 3 [Retired]',
    description: 'Balance of intelligence and speed. Retired July 21, 2025.',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    chatPrice: { input: 3, output: 15 },
    benchmark: { cbaElo: 1283, cbaMmlu: 79 },
    hidden: true,
    isLegacy: true,
  },
  {
    id: 'claude-2.1', // Retired | Retired: July 21, 2025
    label: 'Claude 2.1 [Retired]',
    description: 'Updated version of Claude 2 with improved accuracy. Retired July 21, 2025.',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Early 2023',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 8, output: 24 },
    benchmark: { cbaElo: 1118 },
    hidden: true,
    isLegacy: true,
  },
  {
    id: 'claude-2.0', // Retired | Retired: July 21, 2025
    label: 'Claude 2 [Retired]',
    description: 'Predecessor to Claude 3, offering strong all-round performance. Retired July 21, 2025.',
    contextWindow: 100000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Early 2023',
    interfaces: [LLM_IF_OAI_Chat],
    chatPrice: { input: 8, output: 24 },
    benchmark: { cbaElo: 1132, cbaMmlu: 78.5 },
    hidden: true,
    isLegacy: true,
  },
];
