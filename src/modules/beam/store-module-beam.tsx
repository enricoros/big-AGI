import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import type { DLLMId } from '~/modules/llms/store-llms';
import type { FFactoryId } from './gather/instructions/beam.gather.factories';


/// Presets (persistes as zustand store) ///

interface BeamScatterPreset {
  id: string;
  name: string;
  rayLlmIds: DLLMId[];
  // added post v1, some presets may not have this
  gatherLlmId?: DLLMId;
  gatherFactoryId?: FFactoryId;
}


interface ModuleBeamStore {
  // state
  scatterPresets: BeamScatterPreset[];
  cardScrolling: boolean;
  scatterShowLettering: boolean;
  gatherShowPrompts: boolean;

  // actions
  addScatterPreset: (name: string, rayLlmIds: DLLMId[], gatherLlmId: DLLMId | null, gatherFactoryId: FFactoryId | null) => void;
  deleteScatterPreset: (id: string) => void;
  renameScatterPreset: (id: string, name: string) => void;

  toggleCardScrolling: () => void;
  toggleScatterShowLettering: () => void;
  toggleGatherShowPrompts: () => void;
}


export const useModuleBeamStore = create<ModuleBeamStore>()(persist(
  (_set, _get) => ({

    scatterPresets: [],
    cardScrolling: false,
    scatterShowLettering: false,
    gatherShowPrompts: false,


    addScatterPreset: (name, rayLlmIds, gatherLlmId, gatherFactoryId) => _set(state => ({
      scatterPresets: [...state.scatterPresets, {
        id: uuidv4(),
        name,
        rayLlmIds,
        gatherLlmId: gatherLlmId ?? undefined,
        gatherFactoryId: gatherFactoryId ?? undefined,
      }],
    })),

    deleteScatterPreset: (id) => _set(state => ({
      scatterPresets: state.scatterPresets.filter(preset => preset.id !== id),
    })),

    renameScatterPreset: (id, name) => _set(state => ({
      scatterPresets: state.scatterPresets.map(preset => preset.id === id ? { ...preset, name } : preset),
    })),


    toggleCardScrolling: () => _set(state => ({ cardScrolling: !state.cardScrolling })),

    toggleScatterShowLettering: () => _set(state => ({ scatterShowLettering: !state.scatterShowLettering })),

    toggleGatherShowPrompts: () => _set(state => ({ gatherShowPrompts: !state.gatherShowPrompts })),

  }), {
    name: 'app-module-beam',
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
