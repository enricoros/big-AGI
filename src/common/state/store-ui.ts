import { create } from 'zustand';

import { DLLMId } from '~/modules/llms/llm.types';


/// UI Store (not persisted)

interface UIStore {

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  modelingOpen: boolean;
  openModeling: () => void;
  closeModeling: () => void;

  llmSettingsId: DLLMId | null;
  openLLMSettings: (llmId: DLLMId) => void;
  closeLLMSettings: () => void;

}

export const useUIStore = create<UIStore>()(
  (set) => ({

    settingsOpen: false,
    closeSettings: () => set({ settingsOpen: false }),
    openSettings: () => set({ settingsOpen: true }),

    modelingOpen: false,
    openModeling: () => set({ modelingOpen: true }),
    closeModeling: () => set({ modelingOpen: false }),

    llmSettingsId: null,
    openLLMSettings: (llmId: DLLMId) => set({ llmSettingsId: llmId }),
    closeLLMSettings: () => set({ llmSettingsId: null }),

  }),
);
