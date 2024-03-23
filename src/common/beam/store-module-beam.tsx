import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import type { DLLMId } from '~/modules/llms/store-llms';


/// Presets (persistes as zustand store) ///

interface BeamScatterPreset {
  id: string;
  name: string;
  scatterLlmIds: DLLMId[];
}


interface ModuleBeamStore {
  // state
  scatterPresets: BeamScatterPreset[];
  rayScrolling: boolean;
  gatherShowDevMethods: boolean;
  gatherShowPrompts: boolean;

  // actions
  addScatterPreset: (name: string, scatterLlmIds: DLLMId[]) => void;
  deleteScatterPreset: (id: string) => void;
  renameScatterPreset: (id: string, name: string) => void;

  toggleRayScrolling: () => void;

  toggleGatherShowDevMethods: () => void;
  toggleGatherShowPrompts: () => void;
}


export const useModuleBeamStore = create<ModuleBeamStore>()(persist(
  (_set, _get) => ({

    scatterPresets: [],
    rayScrolling: false,
    gatherShowDevMethods: false,
    gatherShowPrompts: false,


    addScatterPreset: (name, scatterLlmIds) => _set(state => ({
      scatterPresets: [...state.scatterPresets, { id: uuidv4(), name, scatterLlmIds }],
    })),

    deleteScatterPreset: (id) => _set(state => ({
      scatterPresets: state.scatterPresets.filter(preset => preset.id !== id),
    })),

    renameScatterPreset: (id, name) => _set(state => ({
      scatterPresets: state.scatterPresets.map(preset => preset.id === id ? { ...preset, name } : preset),
    })),


    toggleRayScrolling: () => _set(state => ({ rayScrolling: !state.rayScrolling })),


    toggleGatherShowDevMethods: () => _set(state => ({ gatherShowDevMethods: !state.gatherShowDevMethods })),

    toggleGatherShowPrompts: () => _set(state => ({ gatherShowPrompts: !state.gatherShowPrompts })),

  }), {
    name: 'app-module-beam',
  },
));


export function useBeamRayScrolling() {
  return useModuleBeamStore((state) => state.rayScrolling);
}
