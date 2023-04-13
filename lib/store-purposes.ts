import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { SystemPurposeId } from '@/lib/data';

interface PurposeStore {

  // state
  hiddenPurposeIDs: SystemPurposeId[];

  // actions
  toggleHiddenPurposeId: (purposeId: SystemPurposeId) => void;

}


export const usePurposeStore = create<PurposeStore>()(
  persist(
    (set) => ({

      // default state
      hiddenPurposeIDs: ['Designer'],

      toggleHiddenPurposeId: (purposeId: SystemPurposeId) => {
        set(state => {
          const hiddenPurposeIDs = state.hiddenPurposeIDs.includes(purposeId)
            ? state.hiddenPurposeIDs.filter((id) => id !== purposeId)
            : [...state.hiddenPurposeIDs, purposeId];
          return {
            hiddenPurposeIDs,
          };
        });
      },

    }),
    {
      name: 'app-purpose',
    }),
);