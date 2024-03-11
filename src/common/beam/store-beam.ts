import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createStore } from 'zustand/vanilla';
import { type StoreApi, useStore } from 'zustand';

import type { DLLMId } from '~/modules/llms/store-llms';

import { createDMessage, DMessage } from '~/common/state/store-chats';


interface DRay {
  scatterLlmId: DLLMId | null;
  message: DMessage;
  isGenerating?: boolean;
  abortController?: AbortController;
}

interface BeamState {
  isOpen: boolean;
  inputHistory: DMessage[] | null;
  inputIssues: string | null;
  gatherLlmId: DLLMId | null;
  rays: DRay[];
}

export interface BeamStore extends BeamState {

  open: (history: DMessage[], inheritLlmId: DLLMId | null) => void;
  close: () => void;

  setGatherLlmId: (llmId: DLLMId | null) => void;
  setRayCount: (count: number) => void;

  updateRay: (index: number, update: Partial<DRay>) => void;

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
      });
    },

    close: () => _get().isOpen && _set({
      isOpen: false,
      inputHistory: null,
      inputIssues: null,
      // gatherLlmId: null,   // remember the selected llm
      // rays: [],            // remember the rays configuration
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
          rays: [...rays, ...Array(count - rays.length).fill({
            scatterLlmId: null,
            message: createDMessage('assistant', '💫 ...'),
          } satisfies DRay)],
        });
    },

    updateRay: (index: number, update: Partial<DRay>) => _set((state) => ({
      rays: state.rays.map((ray, i) => (i === index)
        ? { ...ray, ...update }
        : ray,
      ),
    })),

  }),
);


export const useBeamStore = <T, >(beamStore: BeamStoreApi, selector: (store: BeamStore) => T): T =>
  useStore(beamStore, selector);


export const useBeamStoreRay = (beamStore: BeamStoreApi, rayIndex: number) => {
  const ray: DRay | null = useStore(beamStore, (store) => store.rays[rayIndex] ?? null);

  const setRayLlmId = React.useCallback((llmId: DLLMId | null) => {
    beamStore.getState().updateRay(rayIndex, { scatterLlmId: llmId });
  }, [beamStore, rayIndex]);

  const clearRayLlmId = React.useCallback(() => {
    setRayLlmId(null);
  }, [setRayLlmId]);

  return { ray, clearRayLlmId, setRayLlmId };
};
