import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createStore } from 'zustand/vanilla';
import { type StoreApi, useStore } from 'zustand';

import { streamAssistantMessage } from '../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';


// Ray - each invidual thread of the beam

type DRayId = string;

interface DRay {
  rayId: DRayId;
  message: DMessage;
  scatterLlmId: DLLMId | null;
  scatterIssue?: string;
  genAbortController?: AbortController;
}

function createDRay(scatterLlmId: DLLMId | null, _index: number): DRay {
  return {
    rayId: uuidv4(),
    message: createDMessage('assistant', '💫 ...'), // String.fromCharCode(65 + index) /*+ ' ... 🖊️'*/ /* '💫 ...' */),
    scatterLlmId,
  };
}


interface BeamState {

  isOpen: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;

  gatherLlmId: DLLMId | null;

  rays: DRay[];

  readyScatter: boolean;
  isScattering: boolean;
  readyGather: boolean;
  isGathering: boolean;

}


export interface BeamStore extends BeamState {

  open: (history: DMessage[], inheritLlmId: DLLMId | null) => void;
  close: () => void;

  setGatherLlmId: (llmId: DLLMId | null) => void;
  setRayCount: (count: number) => void;

  startScatteringAll: () => void;
  stopScatteringAll: () => void;

  updateRayById: (rayId: DRayId, update: Partial<DRay> | ((ray: DRay) => Partial<DRay>)) => void;
  startScattering: (ray: DRay) => DRay;
  stopScattering: (ray: DRay) => DRay;

  syncRaysStateToBeam: () => void;

}

export type BeamStoreApi = Readonly<StoreApi<BeamStore>>;


export const createBeamStore = () => createStore<BeamStore>()(
  (_set, _get) => ({

    // internal
    debugId: uuidv4(),

    // state
    isOpen: false,
    inputHistory: null,
    inputIssues: null,
    gatherLlmId: null,
    rays: [],
    readyScatter: false,
    isScattering: false,
    readyGather: false,
    isGathering: false,


    open: (history: DMessage[], inheritLlmId: DLLMId | null) => {
      const { isOpen: wasOpen, close } = _get();

      // reset pending operations
      close();

      // if just opened, update the model with the current chat model
      const gatherLlmId = !wasOpen && inheritLlmId;

      // validate history
      const isValidHistory = history.length >= 1 && history[history.length - 1].role === 'user';
      _set({
        isOpen: true,
        inputHistory: isValidHistory ? history : null,
        inputIssues: isValidHistory ? null : 'Invalid history',
        ...(gatherLlmId ? { gatherLlmId } : {}),
        readyScatter: isValidHistory,
      });
    },

    close: () => /*_get().isOpen &&*/ _set({
      isOpen: false,
      inputHistory: null,
      inputIssues: null,
      // gatherLlmId: null,   // remember the selected llm
      // remember the model configuration for the rays
      rays: _get().rays.map((ray, index) => createDRay(ray.scatterLlmId, index)),
      readyScatter: false,
      isScattering: false,
      readyGather: false,
      isGathering: false,
    }),


    setGatherLlmId: (llmId: DLLMId | null) => _set({
      gatherLlmId: llmId,
    }),

    setRayCount: (count: number) => {
      const { rays } = _get();
      if (count < rays.length)
        _set({
          rays: rays.slice(0, count),
        });
      else if (count > rays.length)
        _set({
          rays: [...rays, ...Array(count - rays.length).fill(null).map((_, index) => createDRay(null, rays.length + index))],
        });
    },


    startScatteringAll: () => {
      const { readyScatter, isScattering, inputHistory, rays, startScattering } = _get();
      if (!readyScatter || isScattering) {
        console.warn('startScattering: not ready', { isScattering, readyScatter, inputHistory });
        return;
      }
      _set({
        isScattering: true,
        rays: rays.map(startScattering),
      });
    },

    stopScatteringAll: () => {
      const { isScattering, rays, stopScattering } = _get();
      if (!isScattering) {
        console.warn('stopScattering: not scattering', { isScattering });
        return;
      }
      _set({
        isScattering: false,
        rays: rays.map(stopScattering),
      });
    },


    updateRayById: (rayId: DRayId, update: Partial<DRay> | ((ray: DRay) => Partial<DRay>)) => _set((state) => ({
      rays: state.rays.map((ray) => (ray.rayId === rayId)
        ? { ...ray, ...(typeof update === 'function' ? update(ray) : update) }
        : ray,
      ),
    })),

    startScattering: (ray: DRay): DRay => {
      if (ray.genAbortController)
        return ray;

      const { gatherLlmId, inputHistory, rays, updateRayById, syncRaysStateToBeam } = _get();

      // validate model
      const rayLlmId = ray.scatterLlmId || gatherLlmId;
      if (!rayLlmId)
        return { ...ray, scatterIssue: 'No model selected' };

      // validate history
      if (!inputHistory || inputHistory.length < 1 || inputHistory[inputHistory.length - 1].role !== 'user')
        return { ...ray, scatterIssue: `Invalid conversation history (${inputHistory?.length})` };

      const abortController = new AbortController();

      // stream the assistant's messages
      streamAssistantMessage(
        rayLlmId,
        inputHistory,
        rays.length,
        'off',
        (update) => updateRayById(ray.rayId, (ray) => ({
          ...ray,
          message: {
            ...ray.message,
            ...update,
            updated: Date.now(),
          },
        })),
        abortController.signal,
      ).then(() => updateRayById(ray.rayId, {
          genAbortController: undefined,
        },
      )).catch((error) => updateRayById(ray.rayId, {
          genAbortController: undefined,
          scatterIssue: error?.message || error?.toString() || 'Unknown error',
        },
      )).finally(() => {
        syncRaysStateToBeam();
      });

      return {
        ...ray,
        genAbortController: abortController,
      };
    },

    stopScattering: (ray: DRay): DRay => {
      ray.genAbortController?.abort();
      return {
        ...ray,
        genAbortController: undefined,
      };
    },


    syncRaysStateToBeam: () => {
      const { isScattering, rays } = _get();

      // Check if all rays have finished generating
      const allDone = rays.every(ray => !ray.genAbortController);

      if (allDone) {
        // If all rays are done, update state accordingly
        _set({
          isScattering: false,
          // Update other state properties as needed
        });

        console.log('All rays have finished generating');
      } else {
        // If not all rays are done, update state accordingly
        console.log('__Not all rays have finished generating');
      }
    },

  }),
);


export const useBeamStore = <T, >(beamStore: BeamStoreApi, selector: (store: BeamStore) => T): T =>
  useStore(beamStore, selector);


export const useBeamStoreRay = (beamStore: BeamStoreApi, rayIndex: number) => {
  const dRay: DRay | null = useStore(beamStore, (store) => store.rays[rayIndex] ?? null);

  const setRayLlmId = React.useCallback((llmId: DLLMId | null) => {
    beamStore.getState().updateRayById(dRay.rayId, { scatterLlmId: llmId });
  }, [beamStore, dRay.rayId]);

  const clearRayLlmId = React.useCallback(() => {
    setRayLlmId(null);
  }, [setRayLlmId]);

  const startStopRay = React.useCallback(() => {

  }, []);

  return { dRay, clearRayLlmId, setRayLlmId };
};
