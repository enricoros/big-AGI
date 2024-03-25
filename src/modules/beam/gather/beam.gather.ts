import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { DMessage } from '~/common/state/store-chats';
import { FUSION_FACTORIES } from './instructions/beam.gather.factories';
import { GATHER_DEFAULT_TO_FIRST_FUSION, GATHER_PLACEHOLDER } from '../beam.config';
import { gatherStartFusion, gatherStopFusion, Instruction } from './instructions/beam.gather.execution';


/// Gather Store > BFusion ///

type BFusionId = string;

type BFusionStage =
  | 'idle'      // at the beginning, never go back here
  | 'fusing'    // in progress (progressX is defined)
  | 'success'   // completed successfully
  | 'stopped'   // aborted by the user
  | 'error';    // failed (fusionIssue is defined)


export interface BFusion {
  // const
  readonly fusionId: BFusionId;
  readonly factoryId: string;
  readonly instructions: Readonly<Instruction[]>;

  // status
  stage: BFusionStage;
  errorText?: string;
  outputDMessage?: DMessage;

  // execution state to sync Instruction I/O with the UI
  fusingAbortController?: AbortController; // of the full chain
  fusingProgressComponent?: React.ReactNode;
  fusingInstructionComponent?: React.ReactNode;
}

const createBFusion = (factoryId: string, instructions: Instruction[]): BFusion => ({
  // const
  fusionId: uuidv4(),
  factoryId,
  instructions,

  // status
  stage: 'idle',
  errorText: undefined,
  outputDMessage: undefined,

  // execution progress
  fusingAbortController: undefined,
  fusingProgressComponent: undefined,
  fusingInstructionComponent: undefined,
});


export function fusionIsEditable(fusion: BFusion | null): boolean {
  return fusion?.factoryId === 'custom';
}

export function fusionIsIdle(fusion: BFusion | null): boolean {
  return fusion?.stage === 'idle';
}

export function fusionIsFusing(fusion: BFusion | null): boolean {
  return fusion?.stage === 'fusing';
}

export function fusionIsUsableOutput(fusion: BFusion | null): boolean {
  const message = fusion?.outputDMessage ?? null;
  return !!message && !!message.updated && !!message.text && message.text !== GATHER_PLACEHOLDER;
}

export function fusionIsError(fusion: BFusion | null): boolean {
  return fusion?.stage === 'error' || fusion?.errorText !== undefined;
}


/// Gather State Slice ///

interface GatherStateSlice {

  gatherLlmId: DLLMId | null;

  currentFusionId: BFusionId | null;
  fusions: BFusion[];

  // derived state (just acts as a cache to avoid re-calculating)
  isGatheringAny: boolean;

}

export const reInitGatherStateSlice = (prevFusions: BFusion[]): GatherStateSlice => {
  // stop any ongoing fusions
  prevFusions.forEach(gatherStopFusion);

  // fully use new fusions
  const newFusions = FUSION_FACTORIES.map(factory => createBFusion(factory.id, factory.createInstructions()));

  return {
    gatherLlmId: null, // will be re-set during open() of the Beam Store

    currentFusionId: (GATHER_DEFAULT_TO_FIRST_FUSION && newFusions.length) ? newFusions[0].fusionId : null,
    fusions: newFusions,

    isGatheringAny: false,
  };
};

export type FusionUpdateOrFn = Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null));

export interface GatherStoreSlice extends GatherStateSlice {

  setGatherLlmId: (llmId: DLLMId | null) => void;

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
    const isGatheringAny = newFusions.some(fusionIsFusing);

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

    // create a custom from the source fusion factory
    const newCustomFusion: BFusion = createBFusion('custom', sourceFusionFactory.createInstructions());

    // replace the only editable fusion with the new custom fusion
    _set({
      fusions: fusions.map(_f => {
        if (!fusionIsEditable(_f)) return _f;
        gatherStopFusion(_f);
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
    if (fusion) {
      const onUpdate = (update: FusionUpdateOrFn) => _fusionUpdate(fusion.fusionId, update);
      gatherStartFusion(fusion, chatHistory, rays, gatherLlmId, onUpdate);
    }
  },

  currentFusionStop: () => {
    const { _currentFusion, _fusionUpdate } = _get();
    const fusion = _currentFusion();
    if (fusion)
      _fusionUpdate(fusion.fusionId, gatherStopFusion(fusion));
  },

});
