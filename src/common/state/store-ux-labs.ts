import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// UX Labs Experiments

/**
 * Graduated:
 *  - Persona YT Creator: still under a 'true' flag, to disable it if needed
 *  - Text Tools: dinamically shown where applicable
 *  - Chat Mode: follow-ups; moved to Chat Advanced UI, itemized (Auto-title, Auto-diagram)
 */
interface UXLabsStore {

  labsCalling: boolean;
  setLabsCalling: (labsCalling: boolean) => void;

  labsCameraDesktop: boolean;
  setLabsCameraDesktop: (labsCameraDesktop: boolean) => void;

  labsEnhancedUI: boolean;
  setLabsEnhancedUI: (labsEnhancedUI: boolean) => void;

  labsMagicDraw: boolean;
  setLabsMagicDraw: (labsMagicDraw: boolean) => void;

  labsSplitBranching: boolean;
  setLabsSplitBranching: (labsSplitBranching: boolean) => void;

}

export const useUXLabsStore = create<UXLabsStore>()(
  persist(
    (set) => ({

      labsCalling: false,
      setLabsCalling: (labsCalling: boolean) => set({ labsCalling }),

      labsCameraDesktop: false,
      setLabsCameraDesktop: (labsCameraDesktop: boolean) => set({ labsCameraDesktop }),

      labsEnhancedUI: false,
      setLabsEnhancedUI: (labsEnhancedUI: boolean) => set({ labsEnhancedUI }),

      labsMagicDraw: false,
      setLabsMagicDraw: (labsMagicDraw: boolean) => set({ labsMagicDraw }),

      labsSplitBranching: false,
      setLabsSplitBranching: (labsSplitBranching: boolean) => set({ labsSplitBranching }),

    }),
    {
      name: 'app-ux-labs',
    },
  ),
);