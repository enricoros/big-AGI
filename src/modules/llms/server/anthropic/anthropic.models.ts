import type { ModelDescriptionSchema } from '../llm.server.types';

import { LLM_IF_OAI_Chat } from '../../store-llms';

const roundTime = (date: string) => Math.round(new Date(date).getTime() / 1000);

export const hardcodedAnthropicModels: ModelDescriptionSchema[] = [
  {
    id: 'claude-2.1',
    label: 'Claude 2.1',
    created: roundTime('2023-11-21'),
    description: 'Superior performance on tasks that require complex reasoning, with reduced model hallucination rates',
    contextWindow: 200000,
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
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    id: 'claude-1.3',
    label: 'Claude 1.3',
    created: roundTime('2023-03-14'),
    description: 'Claude 1.3 is the latest version of Claude v1',
    contextWindow: 100000,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
  {
    id: 'claude-1.0',
    label: 'Claude 1',
    created: roundTime('2023-03-14'),
    description: 'Claude 1.0 is the first version of Claude',
    contextWindow: 9000,
    interfaces: [LLM_IF_OAI_Chat],
    hidden: true,
  },
];