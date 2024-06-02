import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// UX Labs Experiments

// UxLabsSettings.tsx contains the graduated settings, but the following are not stated:
//  - Text Tools: dinamically shown where applicable
//  - Chat Mode: Follow-Ups; moved to Chat Advanced UI
interface UXLabsStore {

  labsAttachScreenCapture: boolean;
  setLabsAttachScreenCapture: (labsAttachScreenCapture: boolean) => void;

  labsCameraDesktop: boolean;
  setLabsCameraDesktop: (labsCameraDesktop: boolean) => void;

  labsChatBarAlt: false | 'title',
  setLabsChatBarAlt: (labsChatBarAlt: false | 'title') => void;

  labsHighPerformance: boolean;
  setLabsHighPerformance: (labsHighPerformance: boolean) => void;

  labsShowCost: boolean;
  setLabsShowCost: (labsShowCost: boolean) => void;

}

export const useUXLabsStore = create<UXLabsStore>()(
  persist(
    (set) => ({

      labsAttachScreenCapture: false,
      setLabsAttachScreenCapture: (labsAttachScreenCapture: boolean) => set({ labsAttachScreenCapture }),

      labsCameraDesktop: false,
      setLabsCameraDesktop: (labsCameraDesktop: boolean) => set({ labsCameraDesktop }),

      labsChatBarAlt: false,
      setLabsChatBarAlt: (labsChatBarAlt: false | 'title') => set({ labsChatBarAlt }),

      labsHighPerformance: false,
      setLabsHighPerformance: (labsHighPerformance: boolean) => set({ labsHighPerformance }),

      labsShowCost: true, // release 1.16.0 with this enabled by default
      setLabsShowCost: (labsShowCost: boolean) => set({ labsShowCost }),

    }),
    {
      name: 'app-ux-labs',
    },
  ),
);

export function getUXLabsHighPerformance() {
  return useUXLabsStore.getState().labsHighPerformance;
}