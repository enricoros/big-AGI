import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../llm.server.types';


export const hardcodedAnthropicVariants: { [modelId: string]: Partial<ModelDescriptionSchema> } = {

  // Claude 4.1 models with thinking variants
  'claude-opus-4-1-20250805': {
    idVariant: 'thinking',
    label: 'Claude Opus 4.1 (Thinking)',
    description: 'Claude Opus 4.1 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: [{ paramId: 'llmVndAntThinkingBudget', required: true, hidden: false }],
    maxCompletionTokens: 32000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1420 + 10 /* Estimated higher than Opus 4 thinking */ },
  },

  // Claude 4 models with thinking variants
  'claude-opus-4-20250514': {
    hidden: true, // superseded by 4.1
    idVariant: 'thinking',
    label: 'Claude Opus 4 (Thinking)',
    description: 'Claude Opus 4 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: [{ paramId: 'llmVndAntThinkingBudget', required: true, hidden: false }],
    maxCompletionTokens: 32000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1420 },
  },

  'claude-sonnet-4-20250514': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 4 (Thinking)',
    description: 'Claude Sonnet 4 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: [{ paramId: 'llmVndAntThinkingBudget', required: true, hidden: false }],
    maxCompletionTokens: 64000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1399 },
  },

  // Changes to the thinking variant (same model ID) for the Claude Sonnet 3.7 model
  'claude-3-7-sonnet-20250219': {
    idVariant: 'thinking',
    label: 'Claude Sonnet 3.7 (Thinking)',
    description: 'Claude 3.7 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: [{ paramId: 'llmVndAntThinkingBudget', required: true, hidden: false }],
    maxCompletionTokens: 64000,
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1385 },
  },

} as const;


export const hardcodedAnthropicModels: (ModelDescriptionSchema & { isLegacy?: boolean })[] = [

  // Claude 4.1 models
  {
    id: 'claude-opus-4-1-20250805', // Active
    label: 'Claude Opus 4.1', // 🌟
    description: 'Most capable and intelligent model yet. Sets new standards in complex reasoning and advanced coding',
    contextWindow: 200000,
    maxCompletionTokens: 32000,
    trainingDataCutoff: 'Aug 2025',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1420 /* Estimated higher than Opus 4 */ },
  },

  // Claude 4 models
  {
    hidden: true, // superseded by 4.1
    id: 'claude-opus-4-20250514', // Active
    label: 'Claude Opus 4',
    description: 'Previous flagship model with very high intelligence and capability',
    contextWindow: 200000,
    maxCompletionTokens: 32000,
    trainingDataCutoff: 'Mar 2025',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1412 },
  },
  {
    id: 'claude-sonnet-4-20250514', // Active
    label: 'Claude Sonnet 4', // 🌟
    description: 'High-performance model with exceptional reasoning and efficiency',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    trainingDataCutoff: 'Mar 2025',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1386 },
  },

  // Claude 3.7 models
  {
    id: 'claude-3-7-sonnet-20250219', // Active | Guaranteed Until: February 2026
    label: 'Claude Sonnet 3.7',
    description: 'High-performance model with early extended thinking',
    contextWindow: 200000,
    maxCompletionTokens: 64000,
    trainingDataCutoff: 'Oct 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1369 },
  },

  // Claude 3.5 models
  {
    id: 'claude-3-5-sonnet-20241022', // Active | Guaranteed Until: October 2025
    label: 'Claude Sonnet 3.5',
    description: 'High level of intelligence and capability',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1366, cbaMmlu: 88.7 },
  },
  {
    id: 'claude-3-5-sonnet-20240620', // Active | Guaranteed Until: June 2025
    label: 'Claude Sonnet 3.5 (previous)',
    description: 'Previous version of Claude Sonnet 3.5',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1339, cbaMmlu: 88.6 },
    hidden: true,
  },
  {
    id: 'claude-3-5-haiku-20241022', // Active | Guaranteed Until: October 2025
    label: 'Claude Haiku 3.5',
    description: 'Intelligence at blazing speeds',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Jul 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 0.80, output: 4.00, cache: { cType: 'ant-bp', read: 0.08, write: 1.00, duration: 300 } },
    benchmark: { cbaElo: 1316, cbaMmlu: 75.2 },
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
    benchmark: { cbaElo: 1321, cbaMmlu: 86.8 },
    hidden: true, // deprecated
    isLegacy: true,
  },
  {
    id: 'claude-3-haiku-20240307', // Active | Guaranteed Until: March 2025
    label: 'Claude Haiku 3',
    description: 'Quick and accurate targeted performance',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 0.25, output: 1.25, cache: { cType: 'ant-bp', read: 0.03, write: 0.30, duration: 300 } },
    benchmark: { cbaElo: 1179, cbaMmlu: 75.1 },
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
    benchmark: { cbaElo: 1201, cbaMmlu: 79 },
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
