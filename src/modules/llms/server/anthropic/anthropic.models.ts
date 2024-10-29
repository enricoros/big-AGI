import type { ModelDescriptionSchema } from '../llm.server.types';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Vision } from '../../store-llms';

const roundTime = (date: string) => Math.round(new Date(date).getTime() / 1000);

export const hardcodedAnthropicModels: (ModelDescriptionSchema & { isLegacy?: boolean })[] = [
  // Claude 3.5 models - https://docs.anthropic.com/en/docs/about-claude/models
  // {
  //   id: 'claude-3.5-opus', // ...
  //   label: 'Claude 3.5 Opus',
  //   created: roundTime(?),
  //   description: ?,
  //   contextWindow: 200000 ?, // Characters
  //   maxCompletionTokens: 4096 ?,
  //   trainingDataCutoff: ?,
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  //   pricing: { chatIn: 15, chatOut: 75 },
  //   benchmark: {
  //     cbaElo: 1256, // Placeholder
  //     cbaMmlu: 86.8, // Placeholder
  //   },
  // },
  {
    id: 'claude-3-5-sonnet-20241022',
    label: 'Claude 3.5 Sonnet',
    created: roundTime('2024-10-22 06:00'),
    description: 'Most intelligent Claude model to date',
    contextWindow: 200000, // Characters
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    pricing: { chatIn: 3, chatOut: 15 },
    benchmark: { cbaElo: 1269, cbaMmlu: 88.7 }, // moved from 3.5 Sonnet (Previous Version), TO UPDATE!!
  },
  {
    id: 'claude-3-5-sonnet-20240620',
    label: 'Claude 3.5 Sonnet (Previous)',
    created: roundTime('2024-06-20 06:00'),
    description: 'The most intelligent Claude model',
    contextWindow: 200000, // Characters
    maxCompletionTokens: 8192,
    trainingDataCutoff: 'Apr 2024',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    pricing: { chatIn: 3, chatOut: 15 },
    benchmark: { cbaElo: 1269 - 0.1, cbaMmlu: 88.7 - 0.1 },
    hidden: true,
  },
  // {
  //   id: 'claude-3.5-haiku', // ...
  //   label: 'Claude 3.5 Haiku',
  //   created: roundTime(?),
  //   description: ?,
  //   contextWindow: 200000 ?, // Characters
  //   maxCompletionTokens: 4096 ?,
  //   trainingDataCutoff: ?,
  //   interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  //   pricing: { chatIn: 0.25, chatOut: 1.25 },
  //   benchmark: {
  //     cbaElo: 1181, // Placeholder
  //     cbaMmlu: 75.2, // Placeholder
  //   },
  // },


  // Claude 3 models
  {
    id: 'claude-3-opus-20240229',
    label: 'Claude 3 Opus',
    created: roundTime('2024-02-29'),
    description: 'Powerful model for complex tasks',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    pricing: { chatIn: 15, chatOut: 75 },
    benchmark: { cbaElo: 1256, cbaMmlu: 86.8 },
  },
  {
    id: 'claude-3-sonnet-20240229',
    label: 'Claude 3 Sonnet',
    created: roundTime('2024-02-29'),
    description: 'Balance of speed, cost, and performance',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    pricing: { chatIn: 3, chatOut: 15 },
    benchmark: { cbaElo: 1203, cbaMmlu: 79 },
    hidden: true,
    isLegacy: true,
  },
  {
    id: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    created: roundTime('2024-03-07'),
    description: 'Fastest, most cost-effective model',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
    pricing: { chatIn: 0.25, chatOut: 1.25 },
    benchmark: { cbaElo: 1181, cbaMmlu: 75.2 },
  },

  // Claude 2 models
  {
    id: 'claude-2.1',
    label: 'Claude 2.1',
    created: roundTime('2023-11-21'),
    description: 'Superior performance on tasks that require complex reasoning, with reduced model hallucination rates',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    pricing: { chatIn: 8, chatOut: 24 },
    benchmark: { cbaElo: 1119 },
    hidden: true,
  },
  {
    id: 'claude-2.0',
    label: 'Claude 2',
    created: roundTime('2023-07-11'),
    description: 'Superior performance on tasks that require complex reasoning',
    contextWindow: 100000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    pricing: { chatIn: 8, chatOut: 24 },
    benchmark: { cbaElo: 1131, cbaMmlu: 78.5 },
    hidden: true,
  },
  {
    id: 'claude-instant-1.2',
    label: 'Claude Instant 1.2',
    created: roundTime('2023-08-09'),
    description: 'Low-latency, high throughput model',
    contextWindow: 100000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    pricing: { chatIn: 0.8, chatOut: 2.4 },
    hidden: true,
  },
];