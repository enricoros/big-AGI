import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createStore } from 'zustand/vanilla';
import { type StoreApi, useStore } from 'zustand';

import { streamAssistantMessage } from '../../apps/chat/editors/chat-stream';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';


interface DRay {
  message: DMessage;
  scatterLlmId: DLLMId | null;
  scatterIssue?: string;
  isGenerating?: boolean;
  abortController?: AbortController;
}

function createDRay(scatterLlmId: DLLMId | null, index: number): DRay {
  return {
    message: createDMessage('assistant', '💫 ...'), // String.fromCharCode(65 + index) /*+ ' ... 🖊️'*/ /* '💫 ...' */),
    scatterLlmId,
  };
}


export interface BeamStore {

  // state

  isOpen: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;

  gatherLlmId: DLLMId | null;

  rays: DRay[];

  readyScatter: boolean;
  isScattering: boolean;
  readyGather: boolean;
  isGathering: boolean;

  // actions

  open: (history: DMessage[], inheritLlmId: DLLMId | null) => void;
  close: () => void;

  setGatherLlmId: (llmId: DLLMId | null) => void;
  setRayCount: (count: number) => void;

  updateRayByIndex: (index: number, update: Partial<DRay> | ((ray: DRay) => Partial<DRay>)) => void;

  startScattering: (gatherLlmId: DLLMId | null) => void;
  stopScattering: () => void;
  syncState: () => void;

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

    updateRayByIndex: (index: number, update: Partial<DRay> | ((ray: DRay) => Partial<DRay>)) => _set((state) => ({
      rays: state.rays.map((ray, i) => (i === index)
        ? { ...ray, ...(typeof update === 'function' ? update(ray) : update) }
        : ray,
      ),
    })),


    startScattering: (gatherLlmId: DLLMId | null) => {
      const { isScattering, readyScatter, inputHistory, rays, updateRayByIndex, syncState } = _get();
      if (isScattering || !readyScatter) {
        console.warn('startScattering: not ready', { isScattering, readyScatter, inputHistory });
        return;
      }

      // start scattering all rays
      _set({
        isScattering: true,
        rays: rays.map((ray, index) => {

          // validate model
          const rayScatterLlmId = ray.scatterLlmId || gatherLlmId;
          if (!rayScatterLlmId)
            return { ...ray, scatterIssue: 'No model selected' };

          // validate history
          if (!inputHistory || inputHistory.length < 1 || inputHistory[inputHistory.length - 1].role !== 'user')
            return { ...ray, scatterIssue: 'Invalid history' };

          const abortController = new AbortController();

          // stream the assistant's messages
          streamAssistantMessage(
            rayScatterLlmId,
            inputHistory,
            rays.length,
            'off',
            (update) => {
              // console.log(`ray ${index} update`, update);
              updateRayByIndex(index, (ray) => ({ ...ray, message: { ...ray.message, ...update, updated: Date.now() } }));
            },
            abortController.signal,
          ).then(() => {
            updateRayByIndex(index, { isGenerating: false });
          }).catch((error) => {
            console.error(`ray ${index} error`, error);
            updateRayByIndex(index, { isGenerating: false, scatterIssue: error?.message || error?.toString() || 'Unknown error' });
          }).finally(() => {
            syncState();
          });

          return {
            ...ray,
            isGenerating: true,
            abortController: abortController,
          };
        }),
      });

    },

    stopScattering: () => {
      const { isScattering, rays } = _get();
      if (!isScattering) {
        console.warn('stopScattering: not scattering', { isScattering });
        return;
      }

      // TODO...

      // // stop scattering all rays
      // rays.forEach((ray) => {
      //   if (ray.abortController)
      //     ray.abortController.abort();
      // });
      //
      // _set({
      //   isScattering: false,
      // });

    },

    syncState: () => {
      const { isScattering, rays } = _get();

      // Check if all rays have finished generating
      const allDone = rays.every(ray => !ray.isGenerating);

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
    beamStore.getState().updateRayByIndex(rayIndex, { scatterLlmId: llmId });
  }, [beamStore, rayIndex]);

  const clearRayLlmId = React.useCallback(() => {
    setRayLlmId(null);
  }, [setRayLlmId]);

  return { dRay, clearRayLlmId, setRayLlmId };
};
