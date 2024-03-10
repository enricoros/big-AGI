import * as React from 'react';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { DMessage } from '~/common/state/store-chats';

import { ConversationHandler } from './ConversationHandler';


// Per-Beam Store

interface DBeam {
  scatterLlmId: DLLMId | null;
}

interface BeamState {

  isOpen: boolean;
  inputHistory: DMessage[] | null;
  configIssue: string | null;

  gatherLlmId: DLLMId | null;
  rays: DBeam[];

}

export interface BeamStore extends BeamState {

  open: (history: DMessage[]) => void;
  close: () => void;

  setMergedLlmId: (llmId: DLLMId | null) => void;
  setRayCount: (count: number) => void;

  updateRay: (index: number, update: Partial<DBeam>) => void;

}


export const createBeamStore = (initialLlmId: DLLMId | null) => createStore<BeamStore>()(
  (_set, _get) => ({

    isOpen: false,
    inputHistory: null,
    configIssue: null,

    gatherLlmId: initialLlmId,
    rays: [],

    open: (history: DMessage[]) => {
      const isValidHistory = history.length > 0 && history[history.length - 1].role === 'user';
      _set({
        isOpen: true,
        inputHistory: isValidHistory ? history : null,
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


export const useBeamStore = <T, >(conversationHandler: ConversationHandler, selector: (store: BeamStore) => T): T =>
  useStore(conversationHandler.getBeamStore(), selector);


export const useBeamStoreBeam = (conversationHandler: ConversationHandler, beamIndex: number) => {
  const _beamStore = conversationHandler.getBeamStore();

  const beam: DBeam | null = useStore(_beamStore, (store) => store.rays[beamIndex] ?? null);

  const setRayLlmId = React.useCallback((llmId: DLLMId | null) => {
    _beamStore.getState().updateRay(beamIndex, { scatterLlmId: llmId });
  }, [_beamStore, beamIndex]);

  const clearRayLlmId = React.useCallback(() => setRayLlmId(null), [setRayLlmId]);

  return { beam, clearRayLlmId, setRayLlmId };
};
