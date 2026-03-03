import { create } from 'zustand';
import { persist } from 'zustand/middleware';



// UX Labs Experiments

// UxLabsSettings.tsx contains the graduated settings, but the following are not stated:
//  - Text Tools: dynamically shown where applicable
//  - Chat Mode: Follow-Ups; moved to Chat Advanced UI
interface UXLabsStore {

  labsEnhanceCodeBlocks: boolean;
  setLabsEnhanceCodeBlocks: (labsEnhanceCodeBlocks: boolean) => void;

  labsEnhanceCodeLiveFile: boolean;
  setLabsEnhanceCodeLiveFile: (labsEnhanceCodeLiveFile: boolean) => void;

  labsHighPerformance: boolean;
  setLabsHighPerformance: (labsHighPerformance: boolean) => void;

  labsShowCost: boolean;
  setLabsShowCost: (labsShowCost: boolean) => void;

  labsAutoHideComposer: boolean;
  setLabsAutoHideComposer: (labsAutoHideComposer: boolean) => void;

  labsShowShortcutBar: boolean;
  setLabsShowShortcutBar: (labsShowShortcutBar: boolean) => void;

  labsComposerAttachmentsInline: boolean;
  setLabsComposerAttachmentsInline: (labsComposerAttachmentsInline: boolean) => void;

}

export const useUXLabsStore = create<UXLabsStore>()(
  persist(
    (set) => ({

      labsEnhanceCodeBlocks: true,
      setLabsEnhanceCodeBlocks: (labsEnhanceCodeBlocks: boolean) => set({ labsEnhanceCodeBlocks }),

      labsEnhanceCodeLiveFile: false,
      setLabsEnhanceCodeLiveFile: (labsEnhanceCodeLiveFile: boolean) => set({ labsEnhanceCodeLiveFile }),

      labsHighPerformance: false,
      setLabsHighPerformance: (labsHighPerformance: boolean) => set({ labsHighPerformance }),

      labsShowCost: true, // release 1.16.0 with this enabled by default
      setLabsShowCost: (labsShowCost: boolean) => set({ labsShowCost }),

      labsAutoHideComposer: false,
      setLabsAutoHideComposer: (labsAutoHideComposer: boolean) => set({ labsAutoHideComposer }),

      labsShowShortcutBar: true,
      setLabsShowShortcutBar: (labsShowShortcutBar: boolean) => set({ labsShowShortcutBar }),

      labsComposerAttachmentsInline: false,
      setLabsComposerAttachmentsInline: (labsComposerAttachmentsInline: boolean) => set({ labsComposerAttachmentsInline }),

    }),
    {
      name: 'app-ux-labs',

      // Migrations:
      // - 1: turn on the screen capture by default (subsequently removed)
      version: 1,

    },
  ),
);

export function getUXLabsHighPerformance() {
  return useUXLabsStore.getState().labsHighPerformance;
}

