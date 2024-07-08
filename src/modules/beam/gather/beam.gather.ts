import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { StateCreator } from 'zustand/vanilla';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { DMessage } from '~/common/state/store-chats';

import { CUSTOM_FACTORY_ID, FFactoryId, findFusionFactory, FUSION_FACTORIES, FUSION_FACTORY_DEFAULT } from './instructions/beam.gather.factories';
import { GATHER_PLACEHOLDER } from '../beam.config';
import { RootStoreSlice } from '../store-beam-vanilla';
import { ScatterStoreSlice } from '../scatter/beam.scatter';
import { gatherStartFusion, gatherStopFusion, Instruction } from './instructions/beam.gather.execution';
import { updateBeamLastConfig } from '../store-module-beam';


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
  readonly factoryId: FFactoryId;

  // options
  instructions: Instruction[];
  llmId: DLLMId | null;

  // status
  stage: BFusionStage;
  errorText?: string;
  outputDMessage?: DMessage;

  // execution state to sync Instruction I/O with the UI
  fusingAbortController?: AbortController; // of the full chain
  fusingProgressComponent?: React.ReactNode;
  fusingInstructionComponent?: React.ReactNode;
}

const createBFusion = (factoryId: FFactoryId, instructions: Instruction[], llmId: DLLMId | null): BFusion => ({
  // const
  fusionId: uuidv4(),
  factoryId,

  // options
  instructions,
  llmId,

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
  return fusion?.factoryId === CUSTOM_FACTORY_ID;
}

export function fusionIsIdle(fusion: BFusion | null): boolean {
  return fusion?.stage === 'idle';
}

export function fusionIsFusing(fusion: BFusion | null): boolean {
  return fusion?.stage === 'fusing';
}

export function fusionIsStopped(fusion: BFusion | null): boolean {
  return fusion?.stage === 'stopped';
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

  currentFactoryId: FFactoryId | null;
  currentGatherLlmId: DLLMId | null;

  fusions: BFusion[];

  // derived state (just acts as a cache to avoid re-calculating)
  isGatheringAny: boolean;
  // fusionsReady: number;

}

export const reInitGatherStateSlice = (prevFusions: BFusion[], gatherLlmId: DLLMId | null): GatherStateSlice => {
  // stop any ongoing fusions
  prevFusions.forEach(gatherStopFusion);

  return {
    currentFactoryId: FUSION_FACTORY_DEFAULT,
    currentGatherLlmId: gatherLlmId, // may be re-set during open() of the Beam Store

    fusions: [],

    isGatheringAny: false,
    // fusionsReady: 0,
  };
};

export type FusionUpdateOrFn = Partial<BFusion> | ((fusion: BFusion) => (Partial<BFusion> | null));

export interface GatherStoreSlice extends GatherStateSlice {

  setCurrentGatherLlmId: (llmId: DLLMId | null) => void;
  setCurrentFactoryId: (factoryId: FFactoryId | null) => void;

  _fusionUpdate: (fusionId: BFusionId, update: FusionUpdateOrFn) => void;
  fusionRecreateAsCustom: (sourceFusionId: BFusionId) => void;
  fusionInstructionUpdate: (fusionId: BFusionId, instructionIndex: number, update: Partial<Instruction>) => void;
  fusionSetLlmId: (fusionId: BFusionId, llmId: DLLMId | null) => void;

  createFusion: () => void;
  removeFusion: (fusionId: BFusionId) => void;
  toggleFusionGathering: (fusionId: BFusionId) => void;

}

export const createGatherSlice: StateCreator<RootStoreSlice & ScatterStoreSlice & GatherStoreSlice, [], [], GatherStoreSlice> = (_set, _get) => ({

  // initial state
  ...reInitGatherStateSlice([], null),


  setCurrentFactoryId: (factoryId: FFactoryId | null) => {
    _set({
      currentFactoryId: factoryId,
    });
    updateBeamLastConfig({ gatherFactoryId: factoryId });
  },

  setCurrentGatherLlmId: (llmId: DLLMId | null) => {
    _set({
      currentGatherLlmId: llmId,
    });
    updateBeamLastConfig({ gatherLlmId: llmId });
  },


  _fusionUpdate: (fusionId: BFusionId, update: FusionUpdateOrFn) => {
    const { fusions } = _get();

    const newFusions = fusions.map(fusion => (fusion.fusionId === fusionId)
      ? { ...fusion, ...(typeof update === 'function' ? update(fusion) : update) }
      : fusion,
    );

    // 'or' the status of all fusions
    const isGatheringAny = newFusions.some(fusionIsFusing);
    // const fusionsReady = newFusions.filter(fusionIsUsableOutput).length;

    _set({
      fusions: newFusions,
      isGatheringAny,
      // fusionsReady,
    });
  },

  fusionRecreateAsCustom: (sourceFusionId: BFusionId) => {
    const { fusions, currentGatherLlmId } = _get();

    // finds the fusion and its factory
    const sourceFusion = fusions.find(fusion => fusion.fusionId === sourceFusionId);
    const sourceFusionFactory = findFusionFactory(sourceFusion?.factoryId);
    if (!sourceFusion || !sourceFusionFactory)
      return;

    // create a custom from the source fusion factory
    const newCustomFusion: BFusion = createBFusion(CUSTOM_FACTORY_ID, sourceFusionFactory.createInstructions(), currentGatherLlmId);

    // replace the only editable fusion with the new custom fusion
    _set({
      fusions: fusions.map(_f => {
        if (!fusionIsEditable(_f)) return _f;
        gatherStopFusion(_f);
        return newCustomFusion;
      }),
    });
  },

  fusionInstructionUpdate: (fusionId: BFusionId, instructionIndex: number, update: Partial<Instruction>) =>
    _get()._fusionUpdate(fusionId, fusion => ({
      instructions: fusion.instructions.map((instruction, index) => (index === instructionIndex)
        ? { ...instruction, ...update as any /* Note: do not update a different 'type' of instruction ... */ }
        : instruction,
      ),
    })),

  fusionSetLlmId: (fusionId: BFusionId, llmId: DLLMId | null) =>
    _get()._fusionUpdate(fusionId, {
      llmId,
    }),


  createFusion: () => {
    // get factory
    const { currentFactoryId, currentGatherLlmId, fusions, toggleFusionGathering } = _get();
    const factory = FUSION_FACTORIES.find(factory => factory.factoryId === currentFactoryId);
    if (!factory)
      return;

    // create and append the fusion
    const newFusion = createBFusion(factory.factoryId, factory.createInstructions(), currentGatherLlmId);
    _set({
      fusions: [...fusions, newFusion],
    });

    // start the fusion, if not custom
    if (newFusion.factoryId !== CUSTOM_FACTORY_ID)
      toggleFusionGathering(newFusion.fusionId);
  },

  removeFusion: (fusionId: BFusionId) => {
    const fusion = _get().fusions.find(fusion => fusion.fusionId === fusionId);
    if (fusion) {
      gatherStopFusion(fusion);
      _set(state => ({
        fusions: state.fusions.filter(fusion => fusion.fusionId !== fusionId),
      }));
    }
  },


  toggleFusionGathering: (fusionId: BFusionId) => {
    // this will start/stop the fusion
    const fusion = _get().fusions.find(fusion => fusion.fusionId === fusionId);
    if (!fusion) return;

    // stop if fusing
    if (fusion?.stage === 'fusing')
      return gatherStopFusion(fusion);

    // start: update the model (NOTE: keep the same per-fusion)
    // _fusionUpdate(fusion.fusionId, { llmId: currentGatherLlmId });

    // start the fusion
    const { inputHistory, rays, _fusionUpdate } = _get();
    const chatMessages = inputHistory ? [...inputHistory] : [];
    const rayMessages = rays.map(ray => ray.message).filter(message => !!message.text.trim());
    const onUpdate = (update: FusionUpdateOrFn) => _fusionUpdate(fusion.fusionId, update);
    gatherStartFusion(fusion, chatMessages, rayMessages, onUpdate);
  },

});
