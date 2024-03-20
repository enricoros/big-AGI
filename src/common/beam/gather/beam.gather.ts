import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';

import { GATHER_PLACEHOLDER } from '../beam.config';


// Choose, Improve, Fuse, Manual

const commonInitialization = (isEditable: boolean): Pick<BFusion,
  'isEditable' | 'currentInstructionIndex' | 'llmId' | 'status' | 'outputMessage'
> => ({
  isEditable,
  currentInstructionIndex: 0,
  llmId: null,
  status: 'idle',
  outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
});

export const FUSION_FACTORIES: { label: string, factory: () => BFusion }[] = [
  {
    label: 'Guided',
    factory: () => ({
      instructions: [{
        type: 'chat-generate',
        systemPrompt: 'You arfe',
        userPrompt: 'Perform thiws',
        outputType: 'fin',
      }, {
        type: 'user-input-checklist',
      }],
      ...commonInitialization(false),
    }),
  },
  {
    label: 'Fuse',
    factory: () => ({
      instructions: [{
        type: 'chat-generate',
        systemPrompt: 'You are an editor',
        userPrompt: 'Best of all',
        outputType: 'fin',
      }],
      ...commonInitialization(false),
    }),
  },
  {
    label: 'Custom',
    factory: () => ({
      instructions: [{
        type: 'chat-generate',
        systemPrompt: 'You are a custom editor',
        userPrompt: 'Best of all',
        outputType: 'fin',
      }],
      ...commonInitialization(true),
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

export type TInstruction = {
  type: 'chat-generate',
  systemPrompt: string;
  userPrompt: string;
  outputType: 'fin' | 'user-checklist';
} | {
  type: 'user-input-checklist'
};

export interface BFusion {
  // set at creation, adjusted later if this is a custom fusion (and only when idle)
  isEditable: boolean; // only true on a single custom fusion
  instructions: TInstruction[];

  // set at start
  llmId: DLLMId | null;

  // variable
  currentInstructionIndex: number; // points to the next instruction to execute
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
    fusions: FUSION_FACTORIES.map(spec => spec.factory()),
    fusionIndex: null,
    fusionLlmId: null,
    isGathering: false,
  };
};

export interface GatherStoreSlice extends GatherStateSlice {

  setFusionIndex: (index: number | null) => void;
  setFusionLlmId: (llmId: DLLMId | null) => void;

  fusionCustomize: (sourceIndex: number) => void;
  fusionStart: () => void;
  fusionStop: () => void;

  _fusionUpdate: (fusionIndex: number, update: Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null))) => void;

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

  fusionCustomize: (sourceIndex: number) => {
    const { fusions, setFusionIndex, _fusionUpdate } = _get();
    const editableFusionIndex = fusions.findIndex(fusion => fusion.isEditable);
    const fusionFactory = FUSION_FACTORIES[sourceIndex];
    if (editableFusionIndex === -1 || editableFusionIndex === sourceIndex || !fusionFactory)
      return;
    _fusionUpdate(editableFusionIndex, customFusion => {
      // Terminate current custom fusion, if any
      fusionGatherStop(customFusion);
      return {
        ...fusionFactory.factory(),
        isEditable: true,
      };
    });
    setFusionIndex(editableFusionIndex);
  },

  fusionStart: () => {
    console.log('startGatheringCurrent');
  },

  fusionStop: () => {
    console.log('stopGatheringCurrent');
  },

  _fusionUpdate: (fusionIndex: number, update: Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null))) =>
    _set(state => ({
      fusions: state.fusions.map((fusion, index) => (index === fusionIndex)
        ? { ...fusion, ...(typeof update === 'function' ? update(fusion) : update) }
        : fusion,
      ),
    })),

});
