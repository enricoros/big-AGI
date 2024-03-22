import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';
import { bareBonesPromptMixer } from '~/modules/persona/pmix/pmix';

import type { BRay } from '../scatter/beam.scatter';
import { FUSION_FACTORIES } from './beam.gather.factories';
import { GATHER_DEBUG_STATE, GATHER_DEFAULT_TO_FIRST_FUSION, GATHER_PLACEHOLDER } from '../beam.config';
import { createDMessage, DMessage } from '~/common/state/store-chats';


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


function executeChatGenerateInstruction(instruction: TChatGenerateInstruction, fusion: BFusion): Promise<void> {
  // Example implementation - adapt based on actual logic for executing a chat-generate instruction
  return new Promise((resolve, reject) => {
    // Simulate asynchronous operation (e.g., API call)
    setTimeout(() => {
      console.log('Chat Generate Instruction executed:', instruction.name);
      // Update fusion status or perform any other required state updates here
      resolve();
    }, 2000);
  });
}

function executeUserInputChecklistInstruction(instruction: TUserInputChecklistInstruction, fusion: BFusion): Promise<void> {
  // Example implementation - adapt based on your application's UI/input logic
  return new Promise((resolve, reject) => {
    // Logic to display user input prompt and wait for submission
    // This is highly dependent on your UI framework and setup
    console.log('Waiting for user input for:', instruction.name);
    // Simulate receiving user input after some time
    setTimeout(() => {
      console.log('User input received for:', instruction.name);
      resolve();
    }, 5000); // Simulate a 5-second wait for user input
  });
}


function fusionGatherStart(fusion: Readonly<BFusion>, fusionsLlmId: DLLMId | null, raysSnapshot: Readonly<BRay[]>, updateBFusion: (update: Partial<BFusion>) => void, syncGatherState: () => void) {
  // check preconditions
  if (!fusionsLlmId)
    return updateBFusion({ fusionIssue: 'No Merge model selected' });
  if (!raysSnapshot || raysSnapshot.length < 1)
    return updateBFusion({ fusionIssue: 'No responses available' });
  if (fusion.vmState !== null)
    return updateBFusion({ fusionIssue: 'Already performing fusion' });
  if (!(fusion.instructions.length >= 1))
    return updateBFusion({ fusionIssue: 'No fusion instructions available' });

  // Initialize the VM state
  const runningFusion: BFusion = {
    ...fusion,
    vmState: {
      inputLLMId: fusionsLlmId,
      inputRays: raysSnapshot,
      currentInstructionIndex: 0,
      abortController: new AbortController(),
    },
    status: 'fusing',
    fusionIssue: undefined,
    outputMessage: createDMessage('assistant', GATHER_PLACEHOLDER),
  };
  updateBFusion(runningFusion);
  syncGatherState();

  // Start executing the instructions
  let promiseChain = Promise.resolve();
  console.log('executing instructions', fusion.instructions);

  for (const instruction of fusion.instructions) {
    promiseChain = promiseChain.then(() => {
      switch (instruction.type) {
        case 'chat-generate':
          return executeChatGenerateInstruction(instruction as TChatGenerateInstruction, fusion);
        case 'user-input-checklist':
          return executeUserInputChecklistInstruction(instruction as TUserInputChecklistInstruction, fusion);
        default:
          return Promise.reject(new Error('Unsupported Merge instruction'));
      }
    });
  }

  promiseChain.then(() => {
    console.log('All instructions executed for fusion:', fusion.fusionId);
    updateBFusion({ status: 'success' });
    syncGatherState();
  }, (error) => {
    console.error('Error executing instructions:', error, fusion.fusionId);
    updateBFusion({ status: 'error', fusionIssue: error?.message || error?.toString() || 'Unknown error' });
    syncGatherState();
  });
}

function fusionGatherStop(fusion: BFusion): BFusion {
  // fusion.abortController?.abort();
  return {
    ...fusion,
    ...(fusion.status === 'fusing' ? { status: 'stopped' } : {}),
    // abortController: undefined,
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


interface TVMState {
  inputLLMId: DLLMId;
  inputRays: Readonly<BRay[]>;
  currentInstructionIndex: number; // points to the next instruction to execute
  abortController?: AbortController;
}

export interface BFusion {
  // set at creation, adjusted later if this is a custom fusion (and only when idle)
  fusionId: BFusionId;
  factoryId: TFusionFactoryId;
  isEditable: boolean; // only true on a single custom fusion
  instructions: TInstruction[];

  // set at start
  vmState: TVMState | null;

  // variable
  status: 'idle' | 'fusing' | 'success' | 'stopped' | 'error';
  fusionIssue?: string;
  outputMessage?: DMessage;
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
    const { currentFusionId, fusions, fusionsLlmId, _fusionUpdate, _syncFusionsStateToGather } = _get();
    const fusion = currentFusionId !== null ? fusions.find(fusion => fusion.fusionId === currentFusionId) ?? null : null;
    if (fusion) {
      const onUpdate = (update: Partial<BFusion>) => {
        _fusionUpdate(fusion.fusionId, update);
        _syncFusionsStateToGather();
      };
      fusionGatherStart(fusion, fusionsLlmId, raysSnapshot, onUpdate, _syncFusionsStateToGather);
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
