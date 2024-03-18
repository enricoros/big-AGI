import type { ModelDescriptionSchema } from '../llm.server.types';

import { LLM_IF_OAI_Chat, LLM_IF_OAI_Vision } from '../../store-llms';

const roundTime = (date: string) => Math.round(new Date(date).getTime() / 1000);

export const hardcodedAnthropicModels: ModelDescriptionSchema[] = [

  // Claude-3 models - https://docs.anthropic.com/claude/docs/models-overview#model-comparison
  {
    id: 'claude-3-opus-20240229',
    label: 'Claude 3 Opus',
    created: roundTime('2024-02-29'),
    description: 'Most powerful model for highly complex tasks',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    pricing: {
      cpmPrompt: 0.015,
      cpmCompletion: 0.075,
    },
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  },
  {
    id: 'claude-3-sonnet-20240229',
    label: 'Claude 3 Sonnet',
    created: roundTime('2024-02-29'),
    description: 'Ideal balance of intelligence and speed for enterprise workloads',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    pricing: {
      cpmPrompt: 0.003,
      cpmCompletion: 0.015,
    },
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  },
  {
    id: 'claude-3-haiku-20240307',
    label: 'Claude 3 Haiku',
    created: roundTime('2024-03-07'),
    description: 'Fastest and most compact model for near-instant responsiveness',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    pricing: {
      cpmPrompt: 0.00025,
      cpmCompletion: 0.00125,
    },
    trainingDataCutoff: 'Aug 2023',
    interfaces: [LLM_IF_OAI_Chat, LLM_IF_OAI_Vision],
  },

  // Claude 2 models
  {
    id: 'claude-2.1',
    label: 'Claude 2.1',
    created: roundTime('2023-11-21'),
    description: 'Superior performance on tasks that require complex reasoning, with reduced model hallucination rates',
    contextWindow: 200000,
    maxCompletionTokens: 4096,
    pricing: {
      cpmPrompt: 0.008,
      cpmCompletion: 0.024,
    },
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'claude-2.0',
    label: 'Claude 2',
    created: roundTime('2023-07-11'),
    description: 'Superior performance on tasks that require complex reasoning',
    contextWindow: 100000,
    maxCompletionTokens: 4096,
    pricing: {
      cpmPrompt: 0.008,
      cpmCompletion: 0.024,
    },
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    id: 'claude-instant-1.2',
    label: 'Claude Instant 1.2',
    created: roundTime('2023-08-09'),
    description: 'Low-latency, high throughput model',
    contextWindow: 100000,
    maxCompletionTokens: 4096,
    pricing: {
      cpmPrompt: 0.00163,
      cpmCompletion: 0.00551,
    },
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'claude-instant-1.1',
    label: 'Claude Instant 1.1',
    created: roundTime('2023-03-14'),
    description: 'Precise and fast',
    contextWindow: 100000,
    maxCompletionTokens: 2048,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    id: 'claude-1.3',
    label: 'Claude 1.3',
    created: roundTime('2023-03-14'),
    description: 'Claude 1.3 is the latest version of Claude v1',
    contextWindow: 100000,
    maxCompletionTokens: 4096,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
];