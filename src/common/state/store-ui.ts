import { create } from 'zustand';

import { DLLMId } from '~/modules/llms/llm.types';


// UI State - not persisted

interface UIStateStore {

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  modelsSetupOpen: boolean;
  openModelsSetup: () => void;
  closeModelsSetup: () => void;

  llmOptionsId: DLLMId | null;
  openLLMOptions: (llmId: DLLMId) => void;
  closeLLMOptions: () => void;

}

export const useUIStateStore = create<UIStateStore>()(
  (set) => ({

    settingsOpen: false,
    closeSettings: () => set({ settingsOpen: false }),
    openSettings: () => set({ settingsOpen: true }),

    modelsSetupOpen: false,
    openModelsSetup: () => set({ modelsSetupOpen: true }),
    closeModelsSetup: () => set({ modelsSetupOpen: false }),

    llmOptionsId: null,
    openLLMOptions: (llmId: DLLMId) => set({ llmOptionsId: llmId }),
    closeLLMOptions: () => set({ llmOptionsId: null }),

  }),
);
