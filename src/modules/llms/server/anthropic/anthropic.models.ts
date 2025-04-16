import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Reasoning, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../llm.server.types';


export const hardcodedAnthropicVariants: { [modelId: string]: Partial<ModelDescriptionSchema> } = {

  // Changes to the thinking variant (same model ID) for the Claude 3.7 Sonnet model
  'claude-3-7-sonnet-20250219': {
    idVariant: 'thinking',
    label: 'Claude 3.7 Sonnet (Thinking)',
    description: 'Claude 3.7 with extended thinking mode enabled for complex reasoning',
    parameterSpecs: [{ paramId: 'llmVndAntThinkingBudget', required: true, hidden: false }],
    maxCompletionTokens: 65536, // Extended thinking mode - note that the 'anthropic-beta: output-128k-2025-02-19' header would point to a 128k instead
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Reasoning],
    benchmark: { cbaElo: 1303 },
  },

} as const;


export const hardcodedAnthropicModels: (ModelDescriptionSchema & { isLegacy?: boolean })[] = [

  // Claude 3.7 models
  {
    id: 'claude-3-7-sonnet-20250219', // Active | Guaranteed Until: February 2026
    label: 'Claude 3.7 Sonnet', // 🌟
    description: 'Highest level of intelligence and capability with toggleable extended thinking',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Oct 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1295 },
  },

  // Claude 3.5 models
  {
    id: 'claude-3-5-sonnet-20241022', // Active | Guaranteed Until: October 2025
    label: 'Claude 3.5 Sonnet',
    description: 'High level of intelligence and capability',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1283, cbaMmlu: 88.7 },
  },
  {
    id: 'claude-3-5-sonnet-20240620', // Active | Guaranteed Until: June 2025
    label: 'Claude 3.5 Sonnet (previous)',
    description: 'Previous version of Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1268, cbaMmlu: 88.6 },
    hidden: true, // superseded by the v2
  },
  {
    id: 'claude-3-5-haiku-20241022', // Active | Guaranteed Until: October 2025
    label: 'Claude 3.5 Haiku',
    description: 'Intelligence at speed',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Jul 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 0.80, output: 4.00, cache: { cType: 'ant-bp', read: 0.08, write: 1.00, duration: 300 } },
    benchmark: { cbaElo: 1237, cbaMmlu: 75.2 },
  },

  // Claude 3 models
  {
    id: 'claude-3-opus-20240229', // Active | Guaranteed Until: March 2025
    label: 'Claude 3 Opus',
    description: 'Powerful model for complex tasks',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1247, cbaMmlu: 86.8 },
  },
  {
    id: 'claude-3-haiku-20240307', // Active | Guaranteed Until: March 2025
    hidden: true, // close to the guaranteed date
    label: 'Claude 3 Haiku',
    description: 'Quick and accurate targeted performance',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 0.25, output: 1.25, cache: { cType: 'ant-bp', read: 0.03, write: 0.30, duration: 300 } },
    benchmark: { cbaElo: 1179, cbaMmlu: 75.1 },
  },

  // Legacy/Deprecated models
  {
    id: 'claude-3-sonnet-20240229', // Deprecated | Deprecated: January 21, 2025 | Retired: N/A
    label: 'Claude 3 Sonnet',
    description: 'Balance of intelligence and speed. Deprecated on 2025-01-21.',
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
    id: 'claude-2.1', // Deprecated | Deprecated: January 21, 2025 | Retired: N/A
    label: 'Claude 2.1',
    description: 'Updated version of Claude 2 with improved accuracy. Deprecated on 2025-01-21.',
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
    id: 'claude-2.0', // Deprecated | Deprecated: January 21, 2025 | Retired: N/A
    label: 'Claude 2',
    description: 'Predecessor to Claude 3, offering strong all-round performance. Deprecated on 2025-01-21.',
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
