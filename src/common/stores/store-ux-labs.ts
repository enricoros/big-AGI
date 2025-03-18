import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { Is } from '~/common/util/pwaUtils';


// UX Labs Experiments

// UxLabsSettings.tsx contains the graduated settings, but the following are not stated:
//  - Text Tools: dynamically shown where applicable
//  - Chat Mode: Follow-Ups; moved to Chat Advanced UI
interface UXLabsStore {

  labsAttachScreenCapture: boolean;
  setLabsAttachScreenCapture: (labsAttachScreenCapture: boolean) => void;

  labsCameraDesktop: boolean;
  setLabsCameraDesktop: (labsCameraDesktop: boolean) => void;

  labsChatBarAlt: false | 'title',
  setLabsChatBarAlt: (labsChatBarAlt: false | 'title') => void;

  labsEnhanceCodeBlocks: boolean;
  setLabsEnhanceCodeBlocks: (labsEnhanceCodeBlocks: boolean) => void;

  labsEnhanceCodeLiveFile: boolean;
  setLabsEnhanceCodeLiveFile: (labsEnhanceCodeLiveFile: boolean) => void;

  labsHighPerformance: boolean;
  setLabsHighPerformance: (labsHighPerformance: boolean) => void;

  labsShowCost: boolean;
  setLabsShowCost: (labsShowCost: boolean) => void;

  labsShowShortcutBar: boolean;
  setLabsShowShortcutBar: (labsShowShortcutBar: boolean) => void;

  // [DEV MODE] only shown on localhost

  labsDevMode: boolean;
  setLabsDevMode: (labsDevMode: boolean) => void;

  labsDevNoStreaming: boolean;
  setLabsDevNoStreaming: (labsDevNoStreaming: boolean) => void;

}

export const useUXLabsStore = create<UXLabsStore>()(
  persist(
    (set) => ({

      labsAttachScreenCapture: true,
      setLabsAttachScreenCapture: (labsAttachScreenCapture: boolean) => set({ labsAttachScreenCapture }),

      labsCameraDesktop: false,
      setLabsCameraDesktop: (labsCameraDesktop: boolean) => set({ labsCameraDesktop }),

      labsChatBarAlt: false,
      setLabsChatBarAlt: (labsChatBarAlt: false | 'title') => set({ labsChatBarAlt }),

      labsEnhanceCodeBlocks: true,
      setLabsEnhanceCodeBlocks: (labsEnhanceCodeBlocks: boolean) => set({ labsEnhanceCodeBlocks }),

      labsEnhanceCodeLiveFile: false,
      setLabsEnhanceCodeLiveFile: (labsEnhanceCodeLiveFile: boolean) => set({ labsEnhanceCodeLiveFile }),

      labsHighPerformance: false,
      setLabsHighPerformance: (labsHighPerformance: boolean) => set({ labsHighPerformance }),

      labsShowCost: true, // release 1.16.0 with this enabled by default
      setLabsShowCost: (labsShowCost: boolean) => set({ labsShowCost }),

      labsShowShortcutBar: true,
      setLabsShowShortcutBar: (labsShowShortcutBar: boolean) => set({ labsShowShortcutBar }),

      // [DEV MODE] - maybe move them from here

      labsDevMode: false,
      setLabsDevMode: (labsDevMode: boolean) => set({ labsDevMode }),

      labsDevNoStreaming: false,
      setLabsDevNoStreaming: (labsDevNoStreaming: boolean) => set({ labsDevNoStreaming }),

    }),
    {
      name: 'app-ux-labs',

      // Migrations:
      // - 1: turn on the screen capture by default
      version: 1,
      migrate: (state: any, fromVersion: number): UXLabsStore => {
        // 0 -> 1: turn on the screen capture by default
        if (state && fromVersion < 1 && !state.labsAttachScreenCapture)
          return { ...state, labsAttachScreenCapture: true };
        return state;
      },

    },
  ),
);

export function getUXLabsHighPerformance() {
  return useUXLabsStore.getState().labsHighPerformance;
}

export function useLabsDevMode() {
  return useUXLabsStore((state) => state.labsDevMode) && Is.Deployment.Localhost;
}

export function getLabsDevMode() {
  return useUXLabsStore.getState().labsDevMode && Is.Deployment.Localhost;
}

export function getLabsDevNoStreaming() {
  // returns true if in dev mode and no streaming is active
  const { labsDevMode, labsDevNoStreaming } = useUXLabsStore.getState();
  return labsDevMode && labsDevNoStreaming;
}
