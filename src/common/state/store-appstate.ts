import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// App State

interface AppStateData {
  usageCount: number;
  lastSeenChangelogVersion: number;
  suppressedItems: Record<string, boolean>;
}

interface AppStateActions {
  incrementUsage: () => void;
  setLastSeenChangelogVersion: (version: number) => void;
  suppressItem: (key: string) => void;
  unSuppressItem: (key: string) => void;
  resetSuppressedItems: () => void;
}


export const useAppStateStore = create<AppStateData & AppStateActions>()(
  persist(
    (set) => ({
      usageCount: 0,
      incrementUsage: () => set((state) => ({ usageCount: state.usageCount + 1 })),

      lastSeenChangelogVersion: 0,
      setLastSeenChangelogVersion: (version: number) => set({ lastSeenChangelogVersion: version }),

      suppressedItems: {},
      suppressItem: (key: string) => set((state) => ({
        suppressedItems: {
          ...state.suppressedItems,
          [key]: true,
        },
      })),
      unSuppressItem: (key: string) => set((state) => {
        const {
          [key]: _,
          ...rest
        } = state.suppressedItems;
        return { suppressedItems: rest };
      }),

      resetSuppressedItems: () => set({ suppressedItems: {} }),
    }),
    {
      name: 'app-state',
    },
  ),
);