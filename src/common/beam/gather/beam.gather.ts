import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';

import { GATHER_PLACEHOLDER } from '../beam.config';


export interface BFusion {
  // set at creation
  userPrompt: string;

  // set at lifecycle
  llmId: DLLMId | null;

  // variable
  status: 'idle' | 'fusing' | 'success' | 'stopped' | 'error';
  outputMessage: DMessage;
  issue?: string;
  abortController?: AbortController;
}

function createBFusion(systemPrompt: string): BFusion {
  return {
    userPrompt: systemPrompt,
    llmId: null,
    status: 'idle',
    outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
  };
}


// Choose, Improve, Fuse, Manual

interface BeamFusionSpec {
  fType: 'guided' | 'fuse' | 'custom',
  fLabel: string;
  fTemplate: BFusion;
}

export const beamFusionSpecs: BeamFusionSpec[] = [
  {
    fType: 'guided',
    fLabel: 'Guided',
    fTemplate: createBFusion(
      'Use function calling for this - or Json mode?',
    ),
  },
  {
    fType: 'fuse',
    fLabel: 'Fuse',
    fTemplate: createBFusion(
      'I am your father',
    ),
  },
  {
    fType: 'custom',
    fLabel: 'Custom',
    fTemplate: createBFusion(
      '...',
    ),
  },
];

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

export const reInitGatherStateSlice = (prevFusions: BFusion[]): GatherStateSlice => {
  // stop any ongoing fusions
  prevFusions.forEach(fusionGatherStop);

  return {
    // recreate all fusions (no recycle)
    fusions: beamFusionSpecs.map(spec => ({ ...spec.fTemplate })),
    fusionIndex: null,
    fusionLlmId: null,
    isGathering: false,
  };
};

export interface GatherStoreSlice extends GatherStateSlice {

  setFusionIndex: (index: number | null) => void;
  setFusionLlmId: (llmId: DLLMId | null) => void;
  startFusion: () => void;
  stopFusion: () => void;

}

export const createGatherSlice: StateCreator<GatherStoreSlice, [], [], GatherStoreSlice> = (_set, _get) => ({

  // initial state
  ...reInitGatherStateSlice([]),


  setFusionIndex: (index: number | null) =>
    _set({
      fusionIndex: index,
    }),

  setFusionLlmId: (llmId: DLLMId | null) =>
    _set({
      fusionLlmId: llmId,
    }),

  startFusion: () => {
    console.log('startGatheringCurrent');
  },

  stopFusion: () => {
    console.log('stopGatheringCurrent');
  },

});
