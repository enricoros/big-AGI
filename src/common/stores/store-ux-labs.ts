import { create } from 'zustand';
import { persist } from 'zustand/middleware';



// UX Labs Experiments

// UxLabsSettings.tsx contains the graduated settings, but the following are not stated:
//  - Text Tools: dynamically shown where applicable
//  - Chat Mode: Follow-Ups; moved to Chat Advanced UI
interface UXLabsStore {

  labsHighPerformance: boolean;
  setLabsHighPerformance: (labsHighPerformance: boolean) => void;

  labsAutoHideComposer: boolean;
  setLabsAutoHideComposer: (labsAutoHideComposer: boolean) => void;

  labsShowShortcutBar: boolean;
  setLabsShowShortcutBar: (labsShowShortcutBar: boolean) => void;

  labsComposerAttachmentsInline: boolean;
  setLabsComposerAttachmentsInline: (labsComposerAttachmentsInline: boolean) => void;

  labsLosslessImages: boolean;
  setLabsPreserveLosslessImages: (labsLosslessImages: boolean) => void;

}

export const useUXLabsStore = create<UXLabsStore>()(
  persist(
    (set) => ({

      labsHighPerformance: false,
      setLabsHighPerformance: (labsHighPerformance: boolean) => set({ labsHighPerformance }),

      labsAutoHideComposer: false,
      setLabsAutoHideComposer: (labsAutoHideComposer: boolean) => set({ labsAutoHideComposer }),

      labsShowShortcutBar: true,
      setLabsShowShortcutBar: (labsShowShortcutBar: boolean) => set({ labsShowShortcutBar }),

      labsComposerAttachmentsInline: false,
      setLabsComposerAttachmentsInline: (labsComposerAttachmentsInline: boolean) => set({ labsComposerAttachmentsInline }),

      labsLosslessImages: false,
      setLabsPreserveLosslessImages: (labsLosslessImages: boolean) => set({ labsLosslessImages }),

    }),
    {
      name: 'app-ux-labs',

      // Migrations:
      // - 1: turn on the screen capture by default (subsequently removed)
      version: 1,

    },
  ),
);

export function getLabsHighPerformance() {
  return useUXLabsStore.getState().labsHighPerformance;
}

export function getLabsLosslessImages() {
  return useUXLabsStore.getState().labsLosslessImages;
}
