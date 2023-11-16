import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// UI Counters

interface UICountersStore {

  actionCounters: Record<string, number>;
  incrementActionCounter: (key: string) => void;
  clearActionCounter: (key: string) => void;
  clearAllActionCounters: () => void;

}

const useUICountersStore = create<UICountersStore>()(
  persist(
    (set) => ({

      actionCounters: {},
      incrementActionCounter: (key: string) => set(state => ({
        actionCounters: { ...state.actionCounters, [key]: (state.actionCounters[key] || 0) + 1 },
      })),
      clearActionCounter: (key: string) => set(state => ({
        actionCounters: { ...state.actionCounters, [key]: 0 },
      })),
      clearAllActionCounters: () => set({ actionCounters: {} }),

    }),
    {
      name: 'app-ui-counters',
    }),
);

type UiCounterKey = 'export-share' | 'share-chat-link' | 'call-wizard';

export function useUICounter(key: UiCounterKey) {
  const value = useUICountersStore(state => state.actionCounters[key] || 0);
  return { value, novel: !value, touch: () => useUICountersStore.getState().incrementActionCounter(key) };
}


// UI Preferences

interface UIPreferencesStore {

  preferredLanguage: string;
  setPreferredLanguage: (preferredLanguage: string) => void;

  centerMode: 'narrow' | 'wide' | 'full';
  setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => void;

  doubleClickToEdit: boolean;
  setDoubleClickToEdit: (doubleClickToEdit: boolean) => void;

  enterIsNewline: boolean;
  setEnterIsNewline: (enterIsNewline: boolean) => void;

  experimentalLabs: boolean;
  setExperimentalLabs: (experimentalLabs: boolean) => void;

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

      doubleClickToEdit: true,
      setDoubleClickToEdit: (doubleClickToEdit: boolean) => set({ doubleClickToEdit }),

      enterIsNewline: false,
      setEnterIsNewline: (enterIsNewline: boolean) => set({ enterIsNewline }),

      experimentalLabs: false,
      setExperimentalLabs: (experimentalLabs: boolean) => set({ experimentalLabs }),

      renderMarkdown: true,
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

      /* versioning:
       * 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
       */
      version: 1,

      migrate: (state: any, fromVersion: number): UIPreferencesStore => {
        // 0 -> 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
        if (state && fromVersion === 0)
          state.enterIsNewline = state['enterToSend'] === false;
        return state;
      },
    },
  ),
);
