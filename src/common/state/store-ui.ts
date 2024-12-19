import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import { BrowserLang } from '~/common/util/pwaUtils';


// UI Preferences

interface UIPreferencesStore {

  // UI Features

  preferredLanguage: string;
  setPreferredLanguage: (preferredLanguage: string) => void;

  centerMode: 'narrow' | 'wide' | 'full';
  setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => void;

  complexityMode: UIComplexityMode;
  setComplexityMode: (complexityMode: UIComplexityMode) => void;

  contentScaling: ContentScaling;
  setContentScaling: (contentScaling: ContentScaling) => void;
  increaseContentScaling: () => void;
  decreaseContentScaling: () => void;

  disableMarkdown: boolean;
  setDisableMarkdown: (disableMarkdown: boolean) => void;

  doubleClickToEdit: boolean;
  setDoubleClickToEdit: (doubleClickToEdit: boolean) => void;

  enterIsNewline: boolean;
  setEnterIsNewline: (enterIsNewline: boolean) => void;

  renderCodeLineNumbers: boolean;
  setRenderCodeLineNumbers: (renderCodeLineNumbers: boolean) => void;

  renderCodeSoftWrap: boolean;
  setRenderCodeSoftWrap: (renderCodeSoftWrap: boolean) => void;

  showPersonaFinder: boolean;
  setShowPersonaFinder: (showPersonaFinder: boolean) => void;

  // UI Counters

  actionCounters: Record<string, number>;
  incrementActionCounter: (key: string) => void;
  resetActionCounter: (key: string) => void;

}

export const useUIPreferencesStore = create<UIPreferencesStore>()(
  persist(
    (set) => ({

      // UI Features

      preferredLanguage: BrowserLang.orUS,
      setPreferredLanguage: (preferredLanguage: string) => set({ preferredLanguage }),

      centerMode: 'wide',
      setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => set({ centerMode }),

      complexityMode: 'pro',
      setComplexityMode: (complexityMode: UIComplexityMode) => set({ complexityMode }),

      // 2024-07-14: 'sm' is the new default, down from 'md'
      contentScaling: 'sm',
      setContentScaling: (contentScaling: ContentScaling) => set({ contentScaling: contentScaling }),
      increaseContentScaling: () => set((state) => state.contentScaling === 'md' ? state : { contentScaling: state.contentScaling === 'xs' ? 'sm' : 'md' }),
      decreaseContentScaling: () => set((state) => state.contentScaling === 'xs' ? state : { contentScaling: state.contentScaling === 'md' ? 'sm' : 'xs' }),

      doubleClickToEdit: false,
      setDoubleClickToEdit: (doubleClickToEdit: boolean) => set({ doubleClickToEdit }),

      disableMarkdown: false,
      setDisableMarkdown: (disableMarkdown: boolean) => set({ disableMarkdown }),

      enterIsNewline: false,
      setEnterIsNewline: (enterIsNewline: boolean) => set({ enterIsNewline }),

      renderCodeLineNumbers: false,
      setRenderCodeLineNumbers: (renderCodeLineNumbers: boolean) => set({ renderCodeLineNumbers }),

      renderCodeSoftWrap: false,
      setRenderCodeSoftWrap: (renderCodeSoftWrap: boolean) => set({ renderCodeSoftWrap }),

      // Deprecated
      showPersonaFinder: false,
      setShowPersonaFinder: (showPersonaFinder: boolean) => set({ showPersonaFinder }),


      // UI Counters

      actionCounters: {},
      incrementActionCounter: (key: string) =>
        set((state) => ({
          actionCounters: { ...state.actionCounters, [key]: (state.actionCounters[key] || 0) + 1 },
        })),
      resetActionCounter: (key: string) =>
        set((state) => ({
          actionCounters: { ...state.actionCounters, [key]: 0 },
        })),

    }),
    {
      name: 'app-ui',

      /* versioning:
       * 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
       * 2: new Big-AGI 2 defaults
       */
      version: 2,

      migrate: (state: any, fromVersion: number): UIPreferencesStore => {

        // 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
        if (state && fromVersion < 1)
          state.enterIsNewline = state['enterToSend'] === false;

        // 2: new Big-AGI 2 defaults
        if (state && fromVersion < 2) {
          state.contentScaling = 'sm';
          state.doubleClickToEdit = false;
        }

        return state;
      },
    },
  ),
);


export function useUIComplexityMode(): UIComplexityMode {
  return useUIPreferencesStore((state) => state.complexityMode);
}

export function useUIComplexityIsMinimal(): boolean {
  return useUIPreferencesStore((state) => state.complexityMode === 'minimal');
}

export function useUIContentScaling(): ContentScaling {
  return useUIPreferencesStore((state) => state.contentScaling);
}


// former:
//  'export-share'                    // used the export function
//  'share-chat-link'                 // not shared a Chat Link yet
type KnownKeys =
  | 'acknowledge-translation-warning' // displayed if Chrome is translating the page (may crash)
  | 'beam-wizard'                     // first Beam
  | 'call-wizard'                     // first Call
  | 'composer-shift-enter'            // not used Shift + Enter in the Composer yet
  | 'composer-alt-enter'              // not used Alt + Enter in the Composer yet
  | 'composer-ctrl-enter'             // not used Ctrl + Enter in the Composer yet
  ;

export function useUICounter(key: KnownKeys, novelty: number = 1) {
  const value = useUIPreferencesStore((state) => state.actionCounters[key] || 0);

  const touch = React.useCallback(() => useUIPreferencesStore.getState().incrementActionCounter(key), [key]);

  const forget = React.useCallback(() => useUIPreferencesStore.getState().resetActionCounter(key), [key]);

  return {
    // value,
    novel: value < novelty,
    touch,
    forget,
  };
}