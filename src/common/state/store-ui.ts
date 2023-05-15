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

  llmSetupId: DLLMId | null;
  openLLMSetup: (llmId: DLLMId) => void;
  closeLLMSetup: () => void;

}

export const useUIStore = create<UIStore>()(
  (set) => ({

    settingsOpen: false,
    closeSettings: () => set({ settingsOpen: false }),
    openSettings: () => set({ settingsOpen: true }),

    modelingOpen: false,
    openModeling: () => set({ modelingOpen: true }),
    closeModeling: () => set({ modelingOpen: false }),

    llmSetupId: null,
    openLLMSetup: (llmId: DLLMId) => set({ llmSetupId: llmId }),
    closeLLMSetup: () => set({ llmSetupId: null }),

  }),
);
