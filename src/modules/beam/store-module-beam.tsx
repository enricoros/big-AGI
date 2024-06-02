import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import type { DLLMId } from '~/modules/llms/store-llms';
import type { FFactoryId } from './gather/instructions/beam.gather.factories';


/// Presets (persistes as zustand store) ///

export interface BeamConfigSnapshot {
  id: string;
  name: string;
  rayLlmIds: DLLMId[];
  gatherFactoryId?: FFactoryId | null;  // added post launch
  gatherLlmId?: DLLMId | null;          // added post launch
}


interface ModuleBeamState {
  presets: BeamConfigSnapshot[];
  lastConfig: BeamConfigSnapshot | null;
  cardScrolling: boolean;
  scatterShowLettering: boolean;
  scatterShowPrevMessages: boolean;
  gatherAutoStartAfterScatter: boolean;
  gatherShowAllPrompts: boolean;
}

interface ModuleBeamStore extends ModuleBeamState {
  addPreset: (name: string, rayLlmIds: DLLMId[], gatherLlmId: DLLMId | null, gatherFactoryId: FFactoryId | null) => void;
  deletePreset: (id: string) => void;
  renamePreset: (id: string, name: string) => void;

  updateLastConfig: (update: Partial<BeamConfigSnapshot>) => void;
  deleteLastConfig: () => void;

  toggleCardScrolling: () => void;
  toggleScatterShowLettering: () => void;
  toggleScatterShowPrevMessages: () => void;
  toggleGatherAutoStartAfterScatter: () => void;
  toggleGatherShowAllPrompts: () => void;
}


export const useModuleBeamStore = create<ModuleBeamStore>()(persist(
  (_set, _get) => ({

    presets: [],
    lastConfig: null,
    cardScrolling: false,
    scatterShowLettering: false,
    scatterShowPrevMessages: false,
    gatherShowAllPrompts: false,
    gatherAutoStartAfterScatter: false,


    addPreset: (name, rayLlmIds, gatherLlmId, gatherFactoryId) => _set(state => ({
      presets: [...state.presets, {
        id: uuidv4(),
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


    toggleCardScrolling: () => _set(state => ({ cardScrolling: !state.cardScrolling })),

    toggleScatterShowLettering: () => _set(state => ({ scatterShowLettering: !state.scatterShowLettering })),

    toggleScatterShowPrevMessages: () => _set(state => ({ scatterShowPrevMessages: !state.scatterShowPrevMessages })),

    toggleGatherAutoStartAfterScatter: () => _set(state => ({ gatherAutoStartAfterScatter: !state.gatherAutoStartAfterScatter })),

    toggleGatherShowAllPrompts: () => _set(state => ({ gatherShowAllPrompts: !state.gatherShowAllPrompts })),

  }), {
    name: 'app-module-beam',
    version: 1,

    migrate: (state: any, fromVersion: number): ModuleBeamState => {
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

export function updateBeamLastConfig(update: Partial<BeamConfigSnapshot>) {
  useModuleBeamStore.getState().updateLastConfig(update);
}