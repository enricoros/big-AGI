import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';

import { GATHER_PLACEHOLDER } from './beam.config';


// Choose, Improve, Fuse, Manual

export interface BeamFusionSpec {
  id: 'guided' | 'fuse' | 'manual',
  name: string;
}

export const beamFusionSpecs: BeamFusionSpec[] = [
  {
    id: 'guided',
    name: 'Guided',
  },
  { id: 'fuse', name: 'Fuse' },
  { id: 'manual', name: 'Manual' },
];

export interface BFusion {
  fusionId: BeamFusionSpec['id'];
  status: 'idle' | 'fusing' | 'success' | 'stopped' | 'error';
  message: DMessage;
  llmId: DLLMId;
  issue?: string;
  abortController?: AbortController;
}


export function createBFusion(fusionId: BeamFusionSpec['id'], fusionLlmId: DLLMId): BFusion {
  return {
    fusionId,
    status: 'idle',
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