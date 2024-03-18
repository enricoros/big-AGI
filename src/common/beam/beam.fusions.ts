import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';

import { GATHER_PLACEHOLDER } from './beam.config';


export type BFusionId = 'aaa';

export interface BFusion {
  fusionId: BFusionId;
  status: 'fusing' | 'success' | 'stopped' | 'error';
  message: DMessage;
  llmId: DLLMId;
  issue?: string;
  abortController?: AbortController;
}

export function createBFusion(fusionLlmId: DLLMId): BFusion {
  return {
    fusionId: 'aaa',
    status: 'fusing',
    message: createDMessage('assistant', GATHER_PLACEHOLDER),
    llmId: fusionLlmId,
  };
}

export function fusionGatherStop(fusion: BFusion): BFusion {
  fusion.abortController?.abort();
  return {
    ...fusion,
    ...(fusion.status === 'fusing' ? { status: 'stopped' } : {}),
    abortController: undefined,
  };
}