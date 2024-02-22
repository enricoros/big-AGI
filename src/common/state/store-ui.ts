import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ContentScaling } from '~/common/app.theme';


// UI Preferences

interface UIPreferencesStore {

  // UI Features

  preferredLanguage: string;
  setPreferredLanguage: (preferredLanguage: string) => void;

  centerMode: 'narrow' | 'wide' | 'full';
  setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => void;

  contentScaling: ContentScaling;
  setContentScaling: (contentScaling: ContentScaling) => void;
  increaseContentScaling: () => void;
  decreaseContentScaling: () => void;

  doubleClickToEdit: boolean;
  setDoubleClickToEdit: (doubleClickToEdit: boolean) => void;

  enterIsNewline: boolean;
  setEnterIsNewline: (enterIsNewline: boolean) => void;

  renderMarkdown: boolean;
  setRenderMarkdown: (renderMarkdown: boolean) => void;

  // showPersonaExamples: boolean;
  // setShowPersonaExamples: (showPersonaExamples: boolean) => void;

  showPersonaFinder: boolean;
  setShowPersonaFinder: (showPersonaFinder: boolean) => void;

  zenMode: 'clean' | 'cleaner';
  setZenMode: (zenMode: 'clean' | 'cleaner') => void;

  // UI Counters

  actionCounters: Record<string, number>;
  incrementActionCounter: (key: string) => void;

}

export const useUIPreferencesStore = create<UIPreferencesStore>()(
  persist(
    (set) => ({

      // UI Features

      preferredLanguage: (typeof navigator !== 'undefined') && navigator.language || 'en-US',
      setPreferredLanguage: (preferredLanguage: string) => set({ preferredLanguage }),

      centerMode: 'wide',
      setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => set({ centerMode }),

      contentScaling: 'md',
      setContentScaling: (contentScaling: ContentScaling) => set({ contentScaling: contentScaling }),
      increaseContentScaling: () => set((state) => state.contentScaling === 'md' ? state : { contentScaling: state.contentScaling === 'xs' ? 'sm' : 'md' }),
      decreaseContentScaling: () => set((state) => state.contentScaling === 'xs' ? state : { contentScaling: state.contentScaling === 'md' ? 'sm' : 'xs' }),

      doubleClickToEdit: true,
      setDoubleClickToEdit: (doubleClickToEdit: boolean) => set({ doubleClickToEdit }),

      enterIsNewline: false,
      setEnterIsNewline: (enterIsNewline: boolean) => set({ enterIsNewline }),

      renderMarkdown: true,
      setRenderMarkdown: (renderMarkdown: boolean) => set({ renderMarkdown }),

      // showPersonaExamples: false,
      // setShowPersonaExamples: (showPersonaExamples: boolean) => set({ showPersonaExamples }),

      // Deprecated
      showPersonaFinder: false,
      setShowPersonaFinder: (showPersonaFinder: boolean) => set({ showPersonaFinder }),

      zenMode: 'clean',
      setZenMode: (zenMode: 'clean' | 'cleaner') => set({ zenMode }),

      // UI Counters

      actionCounters: {},
      incrementActionCounter: (key: string) =>
        set((state) => ({
          actionCounters: { ...state.actionCounters, [key]: (state.actionCounters[key] || 0) + 1 },
        })),

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

// formerly:
//  - export-share: badge on the 'share' button in the Chat Menu
export function useUICounter(key: 'share-chat-link' | 'call-wizard' | 'composer-shift-enter' | 'acknowledge-translation-warning', novelty: number = 1) {
  const value = useUIPreferencesStore((state) => state.actionCounters[key] || 0);

  const touch = React.useCallback(() =>
      useUIPreferencesStore.getState().incrementActionCounter(key)
    , [key]);

  return {
    // value,
    novel: value < novelty,
    touch,
  };
}