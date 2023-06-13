import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DLLMId } from '~/modules/llms/llm.types';


// UI State - not persisted

interface UIStateStore {

  settingsOpenTab: number; // 0: closed, 1..N: tab index
  openSettings: (tab?: number) => void;
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

    settingsOpenTab: 0,
    openSettings: (tab?: number) => set({ settingsOpenTab: tab || 1 }),
    closeSettings: () => set({ settingsOpenTab: 0 }),

    modelsSetupOpen: false,
    openModelsSetup: () => set({ modelsSetupOpen: true }),
    closeModelsSetup: () => set({ modelsSetupOpen: false }),

    llmOptionsId: null,
    openLLMOptions: (llmId: DLLMId) => set({ llmOptionsId: llmId }),
    closeLLMOptions: () => set({ llmOptionsId: null }),

  }),
);


// UI Preferences

interface UIPreferencesStore {

  preferredLanguage: string;
  setPreferredLanguage: (preferredLanguage: string) => void;

  centerMode: 'narrow' | 'wide' | 'full';
  setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => void;

  enterToSend: boolean;
  setEnterToSend: (enterToSend: boolean) => void;

  renderMarkdown: boolean;
  setRenderMarkdown: (renderMarkdown: boolean) => void;

  showPurposeFinder: boolean;
  setShowPurposeFinder: (showPurposeFinder: boolean) => void;

  showSystemMessages: boolean;
  setShowSystemMessages: (showSystemMessages: boolean) => void;

  zenMode: 'clean' | 'cleaner';
  setZenMode: (zenMode: 'clean' | 'cleaner') => void;

}

export const useUIPreferencesStore = create<UIPreferencesStore>()(
  persist(
    (set) => ({

      preferredLanguage: (typeof navigator !== 'undefined') && navigator.language || 'en-US',
      setPreferredLanguage: (preferredLanguage: string) => set({ preferredLanguage }),

      centerMode: 'wide',
      setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => set({ centerMode }),

      enterToSend: true,
      setEnterToSend: (enterToSend: boolean) => set({ enterToSend }),

      renderMarkdown: false,
      setRenderMarkdown: (renderMarkdown: boolean) => set({ renderMarkdown }),

      showPurposeFinder: false,
      setShowPurposeFinder: (showPurposeFinder: boolean) => set({ showPurposeFinder }),

      showSystemMessages: false,
      setShowSystemMessages: (showSystemMessages: boolean) => set({ showSystemMessages }),

      zenMode: 'clean',
      setZenMode: (zenMode: 'clean' | 'cleaner') => set({ zenMode }),

    }),
    {
      name: 'app-ui',
    }),
);
