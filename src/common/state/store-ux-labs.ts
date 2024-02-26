import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// UX Labs Experiments

/**
 * Graduated:
 *  - see `UxLabsSettings.tsx`, and also:
 *  - Text Tools: dinamically shown where applicable
 *  - Chat Mode: follow-ups; moved to Chat Advanced UI
 */
interface UXLabsStore {

  labsAttachScreenCapture: boolean;
  setLabsAttachScreenCapture: (labsAttachScreenCapture: boolean) => void;

  labsCameraDesktop: boolean;
  setLabsCameraDesktop: (labsCameraDesktop: boolean) => void;

  labsChatBarAlt: false | 'title',
  setLabsChatBarAlt: (labsChatBarAlt: false | 'title') => void;

  labsChatBeam: boolean;
  setLabsChatBeam: (labsChatBeam: boolean) => void;

  labsHighPerformance: boolean;
  setLabsHighPerformance: (labsHighPerformance: boolean) => void;

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

      labsChatBeam: false,
      setLabsChatBeam: (labsChatBeam: boolean) => set({ labsChatBeam }),

      labsHighPerformance: false,
      setLabsHighPerformance: (labsHighPerformance: boolean) => set({ labsHighPerformance }),

    }),
    {
      name: 'app-ux-labs',
    },
  ),
);

export function getUXLabsChatBeam() {
  return useUXLabsStore.getState().labsChatBeam;
}

export function getUXLabsHighPerformance() {
  return useUXLabsStore.getState().labsHighPerformance;
}