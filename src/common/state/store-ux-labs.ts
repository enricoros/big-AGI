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

  labsCameraDesktop: boolean;
  setLabsCameraDesktop: (labsCameraDesktop: boolean) => void;

  labsSplitBranching: boolean;
  setLabsSplitBranching: (labsSplitBranching: boolean) => void;

}

export const useUXLabsStore = create<UXLabsStore>()(
  persist(
    (set) => ({

      labsCameraDesktop: false,
      setLabsCameraDesktop: (labsCameraDesktop: boolean) => set({ labsCameraDesktop }),

      labsSplitBranching: false,
      setLabsSplitBranching: (labsSplitBranching: boolean) => set({ labsSplitBranching }),

    }),
    {
      name: 'app-ux-labs',
    },
  ),
);