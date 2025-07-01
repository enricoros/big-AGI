import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import { agiUuid } from '~/common/util/idUtils';

import type { FFactoryId } from './gather/instructions/beam.gather.factories';


/// Presets (persisted as zustand store) ///

export interface BeamConfigSnapshot {
  id: string;
  name: string;
  rayLlmIds: DLLMId[];
  gatherFactoryId?: FFactoryId | null;  // added post launch
  gatherLlmId?: DLLMId | null;          // added post launch
}


interface ModuleBeamState {

  // stored
  presets: BeamConfigSnapshot[];
  lastConfig: BeamConfigSnapshot | null;
  cardAdd: boolean;
  cardScrolling: boolean;
  scatterShowLettering: boolean;
  scatterShowPrevMessages: boolean;
  gatherAutoStartAfterScatter: boolean;
  gatherShowAllPrompts: boolean;

  // non-stored, temporary but useful for the UI
  openBeamConversationIds: Record<string, boolean>;

}

interface ModuleBeamStore extends ModuleBeamState {
  addPreset: (name: string, rayLlmIds: DLLMId[], gatherLlmId: DLLMId | null, gatherFactoryId: FFactoryId | null) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;

  updateLastConfig: (update: Partial<BeamConfigSnapshot>) => void;
  deleteLastConfig: () => void;

  toggleCardAdd: () => void;
  toggleCardScrolling: () => void;
  toggleScatterShowLettering: () => void;
  toggleScatterShowPrevMessages: () => void;
  toggleGatherAutoStartAfterScatter: () => void;
  toggleGatherShowAllPrompts: () => void;

  setBeamOpenForConversation: (conversationId: DConversationId, isOpen: boolean) => void;
  clearBeamOpenForConversation: (conversationId: DConversationId) => void;
}


export const useModuleBeamStore = create<ModuleBeamStore>()(persist(
  (_set, _get) => ({

    presets: [],
    lastConfig: null,
    cardAdd: true,
    cardScrolling: false,
    scatterShowLettering: false,
    scatterShowPrevMessages: false,
    gatherShowAllPrompts: false,
    gatherAutoStartAfterScatter: false,
    openBeamConversationIds: {},


    addPreset: (name, rayLlmIds, gatherLlmId, gatherFactoryId) => _set(state => ({
      presets: [...state.presets, {
        id: agiUuid('beam-preset-config'),
        name,
        rayLlmIds,
        gatherLlmId: gatherLlmId ?? undefined,
        gatherFactoryId: gatherFactoryId ?? undefined,
      }],
    })),

    deletePreset: (id) => _set(state => ({
      presets: state.presets.filter(preset => preset.id !== id),
    })),

    renamePreset: (id, name) => _set(state => ({
      presets: state.presets.map(preset => preset.id === id ? { ...preset, name } : preset),
    })),


    updateLastConfig: (update) => _set(({ lastConfig }) => ({
      lastConfig: !lastConfig
        ? { id: 'current', name: '', rayLlmIds: [], ...update }
        : { ...lastConfig, ...update },
    })),

    deleteLastConfig: () => _set({ lastConfig: null }),


    toggleCardAdd: () => _set(state => ({ cardAdd: !state.cardAdd })),

    toggleCardScrolling: () => _set(state => ({ cardScrolling: !state.cardScrolling })),

    toggleScatterShowLettering: () => _set(state => ({ scatterShowLettering: !state.scatterShowLettering })),

    toggleScatterShowPrevMessages: () => _set(state => ({ scatterShowPrevMessages: !state.scatterShowPrevMessages })),

    toggleGatherAutoStartAfterScatter: () => _set(state => ({ gatherAutoStartAfterScatter: !state.gatherAutoStartAfterScatter })),

    toggleGatherShowAllPrompts: () => _set(state => ({ gatherShowAllPrompts: !state.gatherShowAllPrompts })),

    setBeamOpenForConversation: (conversationId, isOpen) => _set(state => {
      const openBeams = { ...state.openBeamConversationIds };
      if (isOpen)
        openBeams[conversationId] = true;
      else
        delete openBeams[conversationId];
      return { openBeamConversationIds: openBeams };
    }),

    clearBeamOpenForConversation: (conversationId) => _set(state => {
      const openBeams = { ...state.openBeamConversationIds };
      delete openBeams[conversationId];
      return { openBeamConversationIds: openBeams };
    }),

  }), {
    name: 'app-module-beam',
    version: 1,

    partialize: (state) => {
      // exclude openBeamConversationIds from persistence
      const { openBeamConversationIds, ...persistedState } = state;
      return persistedState;
    },

    migrate: (state: any, fromVersion: number): Omit<ModuleBeamState, 'openBeamConversationIds'> => {
      // 0 -> 1: rename 'scatterPresets' to 'presets'
      if (state && fromVersion === 0 && !state.presets)
        return { ...state, presets: state.scatterPresets || [] };
      return state;
    },
  },
));


export function getBeamCardScrolling() {
  return useModuleBeamStore.getState().cardScrolling;
}

export function useBeamCardScrolling() {
  return useModuleBeamStore((state) => state.cardScrolling);
}

export function useBeamScatterShowLettering() {
  return useModuleBeamStore((state) => state.scatterShowLettering);
}

export function useIsBeamOpenForConversation(conversationId: DConversationId | null): boolean {
  return useModuleBeamStore(state => conversationId ? state.openBeamConversationIds[conversationId] ?? false : false);
}

export function updateBeamLastConfig(update: Partial<BeamConfigSnapshot>) {
  useModuleBeamStore.getState().updateLastConfig(update);
}