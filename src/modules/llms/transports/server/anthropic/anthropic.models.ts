import type { ModelDescriptionSchema } from '../server.schemas';

import { LLM_IF_OAI_Chat } from '../../../store-llms';

const roundTime = (date: string) => Math.round(new Date(date).getTime() / 1000);

export const hardcodedAnthropicModels: ModelDescriptionSchema[] = [
  {
    id: 'claude-2.0',
    label: 'Claude 2',
    created: roundTime('2023-07-11'),
    description: 'Claude-2 is the latest version of Claude',
    contextWindow: 100000,
    interfaces: [LLM_IF_OAI_Chat],
  },
  {
    id: 'claude-instant-1.2',
    label: 'Claude Instant 1.2',
    created: roundTime('2023-08-09'),
    description: 'Precise and faster',
    contextWindow: 100000,
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