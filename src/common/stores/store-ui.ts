import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ContentScaling, UIComplexityMode } from '~/common/app.theme';
import { BrowserLang } from '~/common/util/pwaUtils';
import { Release } from '~/common/app.release';


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

  showModelsHidden: boolean;
  setShowModelsHidden: (showModelsHidden: boolean) => void;

  showModelsStarredOnly: boolean;
  toggleShowModelsStarredOnly: () => void;

  modelsStarredOnTop: boolean;
  setModelsStarredOnTop: (modelsStarredOnTop: boolean) => void;

  composerQuickButton: 'off' | 'call' | 'beam';
  setComposerQuickButton: (composerQuickButton: 'off' | 'call' | 'beam') => void;

  // Advanced features

  aixInspector: boolean;
  toggleAixInspector: () => void;

  // UI Dismissals

  dismissals: Record<string, boolean>;
  dismiss: (key: string) => void;

  // UI Counters

  actionCounters: Record<string, number>;
  incrementActionCounter: (key: string) => void;
  resetActionCounter: (key: string) => void;

  // Optima Panel Grouped List Collapse States

  panelGroupCollapseStates: Record<string, boolean>;
  setPanelGroupCollapsed: (key: string, collapsed: boolean) => void;

}

export const useUIPreferencesStore = create<UIPreferencesStore>()(
  persist(
    (set) => ({

      // UI Features

      preferredLanguage: BrowserLang.orUS,
      setPreferredLanguage: (preferredLanguage: string) => set({ preferredLanguage }),

      centerMode: 'full',
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

      showModelsHidden: false,
      setShowModelsHidden: (showModelsHidden: boolean) => set({ showModelsHidden }),

      showModelsStarredOnly: false,
      toggleShowModelsStarredOnly: () => set((state) => ({ showModelsStarredOnly: !state.showModelsStarredOnly })),

      modelsStarredOnTop: true,
      setModelsStarredOnTop: (modelsStarredOnTop: boolean) => set({ modelsStarredOnTop }),

      composerQuickButton: 'beam',
      setComposerQuickButton: (composerQuickButton: 'off' | 'call' | 'beam') => set({ composerQuickButton }),

      // Advanced features

      aixInspector: false,
      toggleAixInspector: () => set((state) => ({ aixInspector: !state.aixInspector })),

      // UI Dismissals

      dismissals: {},
      dismiss: (key: string) => set((state) => ({
        dismissals: { ...state.dismissals, [key]: true },
      })),

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

      // Panel Grouped List Collapse States

      panelGroupCollapseStates: {},
      setPanelGroupCollapsed: (key: string, collapsed: boolean) =>
        set((state) => ({
          panelGroupCollapseStates: { ...state.panelGroupCollapseStates, [key]: collapsed },
        })),

    }),
    {
      name: 'app-ui',

      /* versioning:
       * 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
       * 2: new Big-AGI 2 defaults
       * 3: centerMode: 'full' is the new default
       */
      version: 3,

      partialize: (state) => {
        if (Release.IsNodeDevBuild) return state; // in dev, persist everything
        // In production, exclude aixInspector from persistence
        const { aixInspector, ...rest } = state;
        return rest;
      },

      migrate: (state: any, fromVersion: number): UIPreferencesStore => {

        // 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
        if (state && fromVersion < 1)
          state.enterIsNewline = state['enterToSend'] === false;

        // 2: new Big-AGI 2 defaults
        if (state && fromVersion < 2) {
          state.contentScaling = 'sm';
          state.doubleClickToEdit = false;
        }

        // 3: centerMode: 'full' is the new default
        if (state && fromVersion < 3) {
          state.centerMode = 'full';
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

export function getAixInspectorEnabled(): boolean {
  return useUIPreferencesStore.getState().aixInspector;
}


export function useUIIsDismissed(key: string | null): boolean | undefined {
  return useUIPreferencesStore((state) => !key ? undefined : Boolean(state.dismissals[key]));
}

export function uiSetDismissed(key: string): void {
  useUIPreferencesStore.getState().dismiss(key);
}


export function useUIPanelGroupCollapsed(key: string | null): boolean | undefined {
  return useUIPreferencesStore((state) => !key ? undefined : state.panelGroupCollapseStates[key]);
}

export function uiSetPanelGroupCollapsed(key: string, collapsed: boolean): void {
  useUIPreferencesStore.getState().setPanelGroupCollapsed(key, collapsed);
}


// former:
//  'export-share'                    // used the export function
//  'share-chat-link'                 // not shared a Chat Link yet
type KnownKeys =
  | 'acknowledge-pwa-desktop-mode-warning' // displayed if mobile PWA is in desktop mode (layout issues)
  | 'acknowledge-translation-warning' // displayed if Chrome is translating the page (may crash)
  | 'beam-wizard'                     // first Beam
  | 'call-wizard'                     // first Call
  | 'composer-shift-enter'            // not used Shift + Enter in the Composer yet
  | 'composer-alt-enter'              // not used Alt + Enter in the Composer yet
  | 'composer-ctrl-enter'             // not used Ctrl + Enter in the Composer yet
  | 'models-setup-first-visit'        // first visit to the Models Setup
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

export function resetUICounter(key: KnownKeys) {
  useUIPreferencesStore.getState().resetActionCounter(key);
}