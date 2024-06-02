import { create } from 'zustand';
import { persist } from 'zustand/middleware';


interface PurposeStore {

  // state
  hiddenPurposeIDs: string[];

  // actions
  toggleHiddenPurposeId: (purposeId: string) => void;

}


export const usePurposeStore = create<PurposeStore>()(
  persist(
    (set) => ({

      // default state
      hiddenPurposeIDs: ['Developer', 'Designer', 'YouTubeTranscriber'],

      toggleHiddenPurposeId: (purposeId: string) => {
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

      /* versioning:
       * 1: hide 'Developer' as 'DeveloperPreview' is best
       * 2: add a hidden 'YouTubeTranscriber' purpose
       */
      version: 2,

      migrate: (state: any, fromVersion: number): PurposeStore => {
        // 0 -> 1: rename 'enterToSend' to 'enterIsNewline' (flip the meaning)
        if (state && fromVersion === 0)
          if (!state.hiddenPurposeIDs.includes('Developer'))
            state.hiddenPurposeIDs.push('Developer');
        // 1 -> 2: add a hidden 'YouTubeTranscriber' purpose
        if (state && fromVersion === 1)
          if (!state.hiddenPurposeIDs.includes('YouTubeTranscriber'))
            state.hiddenPurposeIDs.push('YouTubeTranscriber');
        return state;
      },
    }),
);