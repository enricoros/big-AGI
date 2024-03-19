import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';

import { GATHER_PLACEHOLDER } from '../beam.config';


// Choose, Improve, Fuse, Manual

export interface BeamFusionSpec {
  id: 'guided' | 'fuse' | 'custom',
  name: string;
}

export const beamFusionSpecs: BeamFusionSpec[] = [
  { id: 'guided', name: 'Guided' },
  { id: 'fuse', name: 'Fuse' },
  { id: 'custom', name: 'Custom' },
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


/// Gather Store Slice ///

interface GatherStateSlice {

  fusions: BFusion[];

  fusionIndex: number | null;
  fusionLlmId: DLLMId | null; // i'd love to call this 'gatherLlmId', but it's already used too much and can hide errors

  isGathering: boolean;  // true if any fusion is gathering at the moment

}

export const initGatherStateSlice = (): GatherStateSlice => ({

  fusions: [],

  fusionIndex: null,
  fusionLlmId: null,

  isGathering: false,

});

export interface GatherStoreSlice extends GatherStateSlice {

  setFusionIndex: (index: number | null) => void;
  setFusionLlmId: (llmId: DLLMId | null) => void;
  startGatheringCurrent: () => void;
  stopGatheringCurrent: () => void;

}

export const createGatherSlice: StateCreator<GatherStoreSlice, [], [], GatherStoreSlice> = (_set, _get) => ({

  // initial state
  ...initGatherStateSlice(),


  setFusionIndex: (index: number | null) =>
    _set({
      fusionIndex: index,
    }),

  setFusionLlmId: (llmId: DLLMId | null) =>
    _set({
      fusionLlmId: llmId,
    }),

  startGatheringCurrent: () => {
    console.log('startGatheringCurrent');
  },

  stopGatheringCurrent: () => {
    console.log('stopGatheringCurrent');
  },

});
