import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';

import { GATHER_PLACEHOLDER } from '../beam.config';


// Choose, Improve, Fuse, Manual

export const FUSION_PROGRAMS: { label: string, factory: () => BFusion }[] = [
  {
    label: 'Guided', factory: () => ({
      instructions: [{
        type: 'chat-generate',
        systemPrompt: 'You are',
        userPrompt: 'Perform this',
        outputType: 'fin',
      }],
      currentInstructionIndex: 0,
      isEditable: false,
      llmId: null,
      status: 'idle',
      outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
    }),
  },
  {
    label: 'Fuse', factory: () => ({
      instructions: [{
        type: 'chat-generate',
        systemPrompt: 'You are an editor',
        userPrompt: 'Best of all',
        outputType: 'fin',
      }],
      currentInstructionIndex: 0,
      isEditable: false,
      llmId: null,
      status: 'idle',
      outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER + '2'),
    }),
  },
  {
    label: 'Custom', factory: () => ({
      instructions: [],
      currentInstructionIndex: 0,
      isEditable: true,
      llmId: null,
      status: 'idle',
      outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER + '3'),
    }),
  },
];

function executeInstruction(instruction: TInstruction): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log('executed', instruction);
      resolve();
    }, 1000);
  });
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

type TInstruction = {
  type: 'chat-generate',
  systemPrompt: string;
  userPrompt: string;
  outputType: 'fin' | 'user-checklist';
} | {
  type: 'user-input-checklist'
};

export interface BFusion {
  // set at creation, adjusted later if this is a custom fusion (and only when idle)
  instructions: TInstruction[];
  currentInstructionIndex: number;
  isEditable: boolean;

  // set at lifecycle
  llmId: DLLMId | null;

  // variable
  status: 'idle' | 'fusing' | 'success' | 'stopped' | 'error';
  outputMessage: DMessage;
  issue?: string;
  abortController?: AbortController;
}

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
    fusions: FUSION_PROGRAMS.map(spec => spec.factory()),
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
