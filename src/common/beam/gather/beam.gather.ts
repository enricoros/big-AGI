import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import type { DMessage } from '~/common/state/store-chats';

import type { BRay } from '../scatter/beam.scatter';
import { FUSION_FACTORIES } from './beam.gather.factories';
import { GATHER_DEBUG_STATE, GATHER_DEFAULT_TO_FIRST_FUSION } from '../beam.config';


export function mixInstructionPrompt(prompt: string, raysReady: number): string {
  return bareBonesPromptMixer(prompt, undefined, {
    '{{N}}': raysReady.toString(),
  });
}

function executeInstruction(instruction: TInstruction): Promise<void> {
  return new Promise(resolve => {
    setTimeout(() => {
      console.log('executed', instruction);
      resolve();
    }, 1000);
  });
}

function fusionGatherStart(fusion: BFusion, fusionsLlmId: DLLMId, raysSnapshot: Readonly<BRay[]>): Partial<BFusion> {

  // returns the state update for the Fusion
  return {};
}

function fusionGatherStop(fusion: BFusion): BFusion {
  fusion.abortController?.abort();
  return {
    ...fusion,
    ...(fusion.status === 'fusing' ? { status: 'stopped' } : {}),
    abortController: undefined,
  };
}


/// Gather Store Slice ///

type BFusionId = string;

export type TFusionFactoryId = 'guided' | 'fuse' | 'eval' | 'custom';


export type TChatGenerateInstruction = {
  type: 'chat-generate',
  name: string;
  /**
   * - s-s0-h0-u0-aN-u: sandwiches the existing history and the new proposals in between the System and User prompts of the Instruction
   */
  method: 's-s0-h0-u0-aN-u',
  systemPrompt: string;
  userPrompt: string;
  evalPrompt?: string;
  outputType: 'display-message' | 'user-checklist';
}

export type TUserInputChecklistInstruction = {
  type: 'user-input-checklist'
  name: string;
}

export type TInstruction = TChatGenerateInstruction | TUserInputChecklistInstruction;


export interface BFusion {
  // set at creation, adjusted later if this is a custom fusion (and only when idle)
  fusionId: BFusionId;
  factoryId: TFusionFactoryId;
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


/// Gather State Slice ///

interface GatherStateSlice {

  gatherShowDevMethods: boolean;
  gatherShowPrompts: boolean;

  fusions: BFusion[];
  currentFusionId: BFusionId | null;

  fusionsLlmId: DLLMId | null; // i'd love to call this 'gatherLlmId', but it's already used too much and can hide errors

  isGathering: boolean;  // true if any fusion is gathering at the moment

}

export const reInitGatherStateSlice = (prevFusions: BFusion[]): GatherStateSlice => {
  // stop any ongoing fusions
  prevFusions.forEach(fusionGatherStop);

  // fully use new fusions
  const newFusions = FUSION_FACTORIES.map(spec => spec.factory());

  return {
    gatherShowDevMethods: false,
    gatherShowPrompts: false,

    fusions: newFusions,
    currentFusionId: (GATHER_DEFAULT_TO_FIRST_FUSION && newFusions.length) ? newFusions[0].fusionId : null,

    fusionsLlmId: null, // will be re-set during open() of the Beam Store

    isGathering: false,
  };
};

export interface GatherStoreSlice extends GatherStateSlice {

  toggleGatherShowDevMethods: () => void;
  toggleGatherShowPrompts: () => void;

  setCurrentFusionId: (fusionId: BFusionId | null) => void;
  setFusionsLlmId: (llmId: DLLMId | null) => void;

  fusionRecreateAsCustom: (sourceFusionId: BFusionId) => void;
  fusionInstructionUpdate: (fusionId: BFusionId, instructionIndex: number, update: Partial<TInstruction>) => void;
  currentFusionStart: (raysSnapshot: Readonly<BRay[]>) => void;
  currentFusionStop: () => void;
  _fusionUpdate: (fusionId: BFusionId, update: Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null))) => void;

  _syncFusionsStateToGather: () => void;

}

export const createGatherSlice: StateCreator<GatherStoreSlice, [], [], GatherStoreSlice> = (_set, _get) => ({

  // initial state
  ...reInitGatherStateSlice([]),


  toggleGatherShowDevMethods: () =>
    _set(state => ({
      gatherShowDevMethods: !state.gatherShowDevMethods,
    })),

  toggleGatherShowPrompts: () =>
    _set(state => ({
      gatherShowPrompts: !state.gatherShowPrompts,
    })),

  setCurrentFusionId: (fusionId: BFusionId | null) =>
    _set({
      currentFusionId: fusionId,
    }),

  setFusionsLlmId: (llmId: DLLMId | null) =>
    _set({
      fusionsLlmId: llmId,
    }),

  fusionRecreateAsCustom: (sourceFusionId: BFusionId) => {
    const { fusions } = _get();

    // finds the fusion and its factory
    const sourceFusion = fusions.find(fusion => fusion.fusionId === sourceFusionId);
    const sourceFusionFactory = sourceFusion ? FUSION_FACTORIES.find(spec => spec.id === sourceFusion.factoryId) : undefined;
    if (!sourceFusion || !sourceFusionFactory)
      return;

    const customizableFusionCopy: BFusion = {
      ...sourceFusionFactory.factory(),
      factoryId: 'custom', // changes whatever is the source to 'custom'
      isEditable: true,
    };

    // replace the only editable fusion with the new custom fusion
    _set({
      fusions: fusions.map(fusion => (fusion.isEditable ? customizableFusionCopy : fusion)),
      currentFusionId: customizableFusionCopy.fusionId,
    });
  },

  fusionInstructionUpdate: (fusionId: BFusionId, instructionIndex: number, update: Partial<TInstruction>) =>
    _get()._fusionUpdate(fusionId, fusion => ({
      instructions: fusion.instructions.map((instruction, index) => (index === instructionIndex)
        ? { ...instruction, ...update as any /* Note: do not update a different 'type' of instruction ... */ }
        : instruction,
      ),
    })),


  currentFusionStart: (raysSnapshot: Readonly<BRay[]>) => {
    const { currentFusionId, fusionsLlmId, _fusionUpdate, _syncFusionsStateToGather } = _get();
    if (currentFusionId !== null && fusionsLlmId !== null && raysSnapshot.length) {
      _fusionUpdate(currentFusionId, (fusion) => fusionGatherStart(fusion, fusionsLlmId, raysSnapshot));
      _syncFusionsStateToGather();
    }
  },

  currentFusionStop: () => {
    const { currentFusionId, _fusionUpdate, _syncFusionsStateToGather } = _get();
    if (currentFusionId !== null) {
      _fusionUpdate(currentFusionId, fusionGatherStop);
      _syncFusionsStateToGather();
    }
  },

  _fusionUpdate: (fusionId: BFusionId, update: Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null))) =>
    _set(state => ({
      fusions: state.fusions.map(fusion => (fusion.fusionId === fusionId)
        ? { ...fusion, ...(typeof update === 'function' ? update(fusion) : update) }
        : fusion,
      ),
    })),


  _syncFusionsStateToGather: () => {
    const { fusions } = _get();

    // 'or' the status of all fusions
    const isGathering = fusions.some(fusion => fusion.status === 'fusing');

    // [debug]
    if (GATHER_DEBUG_STATE)
      console.log('_syncFusionsStateToGather', { fusions: fusions.length, isGathering });

    _set({
      isGathering,
    });
  },

});
