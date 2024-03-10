import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { createStore } from 'zustand/vanilla';
import { type StoreApi, useStore } from 'zustand';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { DMessage } from '~/common/state/store-chats';


// Per-Beam Store

interface DBeam {
  scatterLlmId: DLLMId | null;
}

interface BeamState {

  isOpen: boolean;
  inputHistory: DMessage[] | null;
  gatherLlmId: DLLMId | null;
  configIssue: string | null;

  rays: DBeam[];

}

export interface BeamStore extends BeamState {

  open: (history: DMessage[], inheritLlmId: DLLMId | null) => void;
  close: () => void;

  setMergedLlmId: (llmId: DLLMId | null) => void;
  setRayCount: (count: number) => void;

  updateRay: (index: number, update: Partial<DBeam>) => void;

}

export type BeamStoreApi = Readonly<StoreApi<BeamStore>>;


export const createBeamStore = () => createStore<BeamStore>()(
  (_set, _get) => ({

    debugId: uuidv4(),
    isOpen: false,
    inputHistory: null,
    gatherLlmId: null,
    configIssue: null,

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
        ...(gatherLlmId ? { gatherLlmId } : {}),
        configIssue: isValidHistory ? null : 'Invalid history',
      });
    },

    close: () => _get().isOpen && _set({
      isOpen: false,
      inputHistory: null,
      configIssue: null,
      // gatherLlmId: null,   // remember the selected llm
      // rays: [],            // remember the rays configuration
    }),

    setMergedLlmId: (llmId: DLLMId | null) => _set({
      gatherLlmId: llmId,
    }),

    setRayCount: (count: number) => {
      const { rays } = _get();
      if (count < rays.length)
        _set({ rays: rays.slice(0, count) });
      else if (count > rays.length)
        _set({ rays: [...rays, ...Array(count - rays.length).fill({ scatterLlmId: null })] });
    },

    updateRay: (index: number, update: Partial<DBeam>) => _set((state) => ({
      rays: state.rays.map((ray, i) => (i === index)
        ? { ...ray, ...update }
        : ray,
      ),
    })),

  }),
);


export const useBeamStore = <T, >(beamStore: BeamStoreApi, selector: (store: BeamStore) => T): T =>
  useStore(beamStore, selector);


export const useBeamStoreBeam = (_beamStore: BeamStoreApi, beamIndex: number) => {
  const beam: DBeam | null = useStore(_beamStore, (store) => store.rays[beamIndex] ?? null);

  const setRayLlmId = React.useCallback((llmId: DLLMId | null) => {
    _beamStore.getState().updateRay(beamIndex, { scatterLlmId: llmId });
  }, [_beamStore, beamIndex]);

  const clearRayLlmId = React.useCallback(() => setRayLlmId(null), [setRayLlmId]);

  return { beam, clearRayLlmId, setRayLlmId };
};
