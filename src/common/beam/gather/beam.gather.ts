import { v4 as uuidv4 } from 'uuid';
import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { DMessage } from '~/common/state/store-chats';
import { FUSION_FACTORIES } from './beam.gather.factories';
import { GATHER_DEFAULT_TO_FIRST_FUSION, GATHER_PLACEHOLDER } from '../beam.config';
import { executeFusionInstructions, fusionGatherStop, Instruction } from './beam.gather.instructions';


/// Gather Store > BFusion ///

type BFusionId = string;

export interface BFusion {
  // const
  readonly fusionId: BFusionId;
  readonly factoryId: string;
  readonly instructions: Readonly<Instruction[]>;

  // state
  status: 'idle' | 'fusing' | 'success' | 'stopped' | 'error';
  fusionIssue?: string;
  outputMessage?: DMessage;

  // specific state during execution to sync Instruction I/O with the UI (will be added later)
  abortController?: AbortController;
}

export const createBFusion = (factoryId: string, instructions: Instruction[]): BFusion => ({
  fusionId: uuidv4(),
  factoryId,
  instructions,
  status: 'idle',
  fusionIssue: undefined,
  outputMessage: undefined,
  abortController: undefined,
});

export function fusionIsEditable(fusion: BFusion | null): boolean {
  return fusion?.factoryId === 'custom';
}

export function fusionIsError(fusion: BFusion | null): boolean {
  return fusion?.status === 'error' || fusion?.fusionIssue !== undefined;
}

export function fusionIsIdle(fusion: BFusion | null): boolean {
  return fusion?.status === 'idle';
}

export function fusionIsFusing(fusion: BFusion | null): boolean {
  return fusion?.status === 'fusing';
}

export function fusionIsUsable(fusion: BFusion | null): boolean {
  return !!fusion?.outputMessage && !!fusion.outputMessage.updated && !!fusion.outputMessage.text && fusion.outputMessage.text !== GATHER_PLACEHOLDER;
}


/// Gather State Slice ///

interface GatherStateSlice {

  gatherLlmId: DLLMId | null;

  gatherShowDevMethods: boolean;
  gatherShowPrompts: boolean;

  currentFusionId: BFusionId | null;
  fusions: BFusion[];

  // derived state (just acts as a cache to avoid re-calculating)
  isGatheringAny: boolean;

}

export const reInitGatherStateSlice = (prevFusions: BFusion[]): GatherStateSlice => {
  // stop any ongoing fusions
  prevFusions.forEach(fusionGatherStop);

  // fully use new fusions
  const newFusions = FUSION_FACTORIES.map(spec => spec.factory());

  return {
    gatherLlmId: null, // will be re-set during open() of the Beam Store

    gatherShowDevMethods: false,
    gatherShowPrompts: false,

    currentFusionId: (GATHER_DEFAULT_TO_FIRST_FUSION && newFusions.length) ? newFusions[0].fusionId : null,
    fusions: newFusions,

    isGatheringAny: false,
  };
};

export type FusionUpdateOrFn = Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null));

export interface GatherStoreSlice extends GatherStateSlice {

  setGatherLlmId: (llmId: DLLMId | null) => void;
  toggleGatherShowDevMethods: () => void;
  toggleGatherShowPrompts: () => void;

  setCurrentFusionId: (fusionId: BFusionId | null) => void;
  _currentFusion: () => BFusion | null;

  _fusionUpdate: (fusionId: BFusionId, update: FusionUpdateOrFn) => void;
  fusionRecreateAsCustom: (sourceFusionId: BFusionId) => void;
  fusionInstructionUpdate: (fusionId: BFusionId, instructionIndex: number, update: Partial<Instruction>) => void;

  currentFusionStart: (chatHistory: DMessage[], rays: DMessage[]) => void;
  currentFusionStop: () => void;

}

export const createGatherSlice: StateCreator<GatherStoreSlice, [], [], GatherStoreSlice> = (_set, _get) => ({

  // initial state
  ...reInitGatherStateSlice([]),


  setGatherLlmId: (llmId: DLLMId | null) =>
    _set({
      gatherLlmId: llmId,
    }),

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

  _currentFusion: () => {
    const { currentFusionId, fusions } = _get();
    return currentFusionId !== null ? fusions.find(fusion => fusion.fusionId === currentFusionId) ?? null : null;
  },


  _fusionUpdate: (fusionId: BFusionId, update: FusionUpdateOrFn) => {
    const { fusions } = _get();

    const newFusions = fusions.map(fusion => (fusion.fusionId === fusionId)
      ? { ...fusion, ...(typeof update === 'function' ? update(fusion) : update) }
      : fusion,
    );

    // 'or' the status of all fusions
    const isGatheringAny = newFusions.some(fusion => fusion.status === 'fusing');

    _set({
      fusions: newFusions,
      isGatheringAny,
    });
  },

  fusionRecreateAsCustom: (sourceFusionId: BFusionId) => {
    const { fusions } = _get();

    // finds the fusion and its factory
    const sourceFusion = fusions.find(fusion => fusion.fusionId === sourceFusionId);
    const sourceFusionFactory = sourceFusion ? FUSION_FACTORIES.find(spec => spec.id === sourceFusion.factoryId) : undefined;
    if (!sourceFusion || !sourceFusionFactory)
      return;

    const newCustomFusion: BFusion = {
      ...sourceFusionFactory.factory(),
      factoryId: 'custom', // changes whatever is the source to 'custom', which makes it editable
    };

    // replace the only editable fusion with the new custom fusion
    _set({
      fusions: fusions.map(_f => {
        if (!fusionIsEditable(_f)) return _f;
        fusionGatherStop(_f);
        return newCustomFusion;
      }),
      currentFusionId: newCustomFusion.fusionId,
    });
  },

  fusionInstructionUpdate: (fusionId: BFusionId, instructionIndex: number, update: Partial<Instruction>) =>
    _get()._fusionUpdate(fusionId, fusion => ({
      instructions: fusion.instructions.map((instruction, index) => (index === instructionIndex)
        ? { ...instruction, ...update as any /* Note: do not update a different 'type' of instruction ... */ }
        : instruction,
      ),
    })),


  currentFusionStart: (chatHistory: DMessage[], rays: DMessage[]) => {
    const { gatherLlmId, _currentFusion, _fusionUpdate } = _get();
    const fusion = _currentFusion();

    // validate inputs, or error out
    if (!fusion)
      return;
    if (!gatherLlmId)
      return _fusionUpdate(fusion.fusionId, { fusionIssue: 'No Merge model selected' });
    if (chatHistory.length < 1)
      return _fusionUpdate(fusion.fusionId, { fusionIssue: 'No conversation history available' });
    if (rays?.length <= 1)
      return _fusionUpdate(fusion.fusionId, { fusionIssue: 'No responses available' });
    if (!(fusion.instructions.length >= 1))
      return _fusionUpdate(fusion.fusionId, { fusionIssue: 'No fusion instructions available' });

    executeFusionInstructions(
      fusion,
      gatherLlmId,
      chatHistory,
      rays,
      (update: FusionUpdateOrFn) => _fusionUpdate(fusion.fusionId, update),
    );
  },

  currentFusionStop: () => {
    const { _currentFusion, _fusionUpdate } = _get();
    const fusion = _currentFusion();
    if (fusion)
      _fusionUpdate(fusion.fusionId, fusionGatherStop(fusion));
  },

});
