import { LLM_IF_ANT_PromptCaching, LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_OAI_Vision } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../llm.server.types';


const roundTime = (date: string) => Math.round(new Date(date).getTime() / 1000);

export const hardcodedAnthropicModels: (ModelDescriptionSchema & { isLegacy?: boolean })[] = [
  // Claude 3.5 models - https://docs.anthropic.com/en/docs/about-claude/models
  {
    id: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    created: roundTime('2024-10-22 06:00'),
    description: 'Most intelligent Claude model to date',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1269, cbaMmlu: 88.7 }, // moved from 3.5 Sonnet (Previous Version), TO UPDATE!!
  },
  {
    id: 'claude-3-5-haiku-20241022',
    label: 'Claude 3.5 Haiku',
    created: roundTime('2024-10-22 06:00'),
    description: 'Our fastest model',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Jul 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 1, output: 5, cache: { cType: 'ant-bp', read: 0.10, write: 1.25, duration: 300 } },
    benchmark: { cbaElo: 1179, cbaMmlu: 75.2 }, // moved from 3.5 Haiku (Previous Version), TO UPDATE!!
  },
  {
    id: 'claude-3-5-sonnet-20240620',
    label: 'Claude 3.5 Sonnet (Previous)',
    created: roundTime('2024-06-20 06:00'),
    description: 'Previous version of Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 3, output: 15, cache: { cType: 'ant-bp', read: 0.30, write: 3.75, duration: 300 } },
    benchmark: { cbaElo: 1269 - 0.1, cbaMmlu: 88.7 - 0.1 },
    hidden: true,
  },

  // Claude 3 models
  {
    id: 'claude-3-opus-20240229',
    label: 'Claude 3 Opus',
    created: roundTime('2024-02-29'),
    description: 'Excels at writing and complex tasks',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 15, output: 75, cache: { cType: 'ant-bp', read: 1.50, write: 18.75, duration: 300 } },
    benchmark: { cbaElo: 1248, cbaMmlu: 86.8 },
  },
  {
    id: 'claude-3-sonnet-20240229',
    label: 'Claude 3 Sonnet',
    created: roundTime('2024-02-29'),
    description: 'Balance of intelligence and speed',
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
    id: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    created: roundTime('2024-03-07'),
    description: 'Fastest and most compact model for near-instant responsiveness',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision, LLM_IF_OAI_Fn, LLM_IF_ANT_PromptCaching],
    chatPrice: { input: 0.25, output: 1.25, cache: { cType: 'ant-bp', read: 0.03, write: 0.30, duration: 300 } },
    benchmark: { cbaElo: 1179 - 0.1, cbaMmlu: 75.2 - 0.1 },
  },

  // Legacy models - https://docs.anthropic.com/en/docs/about-claude/models#legacy-models
  // Add deprecated as per https://docs.anthropic.com/en/docs/resources/model-deprecations
  {
    id: 'claude-2.1',
    label: 'Claude 2.1',
    created: roundTime('2023-11-21'),
    description: 'Updated version of Claude 2 with improved accuracy',
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
    id: 'claude-2.0',
    label: 'Claude 2',
    created: roundTime('2023-07-11'),
    description: 'Predecessor to Claude 3, offering strong all-round performance',
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
