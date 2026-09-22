import { create } from 'zustand';
import { persist } from 'zustand/middleware';



// UX Labs Experiments

// UxLabsSettings.tsx contains the graduated settings, but the following are not stated:
//  - Text Tools: dynamically shown where applicable
//  - Chat Mode: Follow-Ups; moved to Chat Advanced UI
interface UXLabsStore {

  labsAdaptiveRendering: 'auto' | 'on' | 'off' | 'debug'; // lighter rendering of streaming blocks: when heavy, always, never, as auto + highlight + log
  setLabsAdaptiveRendering: (labsAdaptiveRendering: 'auto' | 'on' | 'off' | 'debug') => void;

  labsUnlockRefresh: boolean; // ex 'labsHighPerformance' (Labs toggle, removed) - renamed to reset it; switch in the AI Inspector, commented out
  setLabsUnlockRefresh: (labsUnlockRefresh: boolean) => void;

  labsAutoHideComposer: boolean;
  setLabsAutoHideComposer: (labsAutoHideComposer: boolean) => void;

  labsScreenWakeLock: boolean; // mobile: keep the screen on while generations run - default on, no UI yet
  setLabsScreenWakeLock: (labsScreenWakeLock: boolean) => void;

  labsShowShortcutBar: boolean;
  setLabsShowShortcutBar: (labsShowShortcutBar: boolean) => void;

  labsComposerAttachmentsInline: boolean;
  setLabsComposerAttachmentsInline: (labsComposerAttachmentsInline: boolean) => void;

  labsLosslessImages: boolean;
  setLabsPreserveLosslessImages: (labsLosslessImages: boolean) => void;

  labsSingleDollarLatex: boolean;
  setLabsSingleDollarLatex: (labsSingleDollarLatex: boolean) => void;

}

export const useUXLabsStore = create<UXLabsStore>()(
  persist(
    (set) => ({

      labsAdaptiveRendering: 'off', // opt-in while in Labs
      setLabsAdaptiveRendering: (labsAdaptiveRendering: 'auto' | 'on' | 'off' | 'debug') => set({ labsAdaptiveRendering }),

      labsUnlockRefresh: false,
      setLabsUnlockRefresh: (labsUnlockRefresh: boolean) => set({ labsUnlockRefresh }),

      labsAutoHideComposer: false,
      setLabsAutoHideComposer: (labsAutoHideComposer: boolean) => set({ labsAutoHideComposer }),

      labsScreenWakeLock: true,
      setLabsScreenWakeLock: (labsScreenWakeLock: boolean) => set({ labsScreenWakeLock }),

      labsShowShortcutBar: true,
      setLabsShowShortcutBar: (labsShowShortcutBar: boolean) => set({ labsShowShortcutBar }),

      labsComposerAttachmentsInline: false,
      setLabsComposerAttachmentsInline: (labsComposerAttachmentsInline: boolean) => set({ labsComposerAttachmentsInline }),

      labsLosslessImages: false,
      setLabsPreserveLosslessImages: (labsLosslessImages: boolean) => set({ labsLosslessImages }),

      labsSingleDollarLatex: false,
      setLabsSingleDollarLatex: (labsSingleDollarLatex: boolean) => set({ labsSingleDollarLatex }),

    }),
    {
      name: 'app-ux-labs',

      // Migrations:
      // - 1: turn on the screen capture by default (subsequently removed)
      version: 1,
      migrate: (state: any): UXLabsStore => state, // no shape change here: passthrough re-stamps older blobs, keeps unknown fields

    },
  ),
);

export function getLabsHighPerformance() {
  return useUXLabsStore.getState().labsUnlockRefresh;
}

export function getLabsLosslessImages() {
  return useUXLabsStore.getState().labsLosslessImages;
}

export function getLabsScreenWakeLock() {
  return useUXLabsStore.getState().labsScreenWakeLock;
}

export function useLabsAdaptiveRendering() {
  return useUXLabsStore((s) => s.labsAdaptiveRendering);
}
