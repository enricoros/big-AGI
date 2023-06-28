import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// App State

interface AppStateData {
  usageCount: number;
  lastSeenChangelogVersion: number;
  suppressedItems: Record<string, boolean>;
}

interface AppStateActions {
  setLastSeenChangelogVersion: (version: number) => void;
  suppressItem: (key: string) => void;
  unSuppressItem: (key: string) => void;
  resetSuppressedItems: () => void;
}


export const useAppStateStore = create<AppStateData & AppStateActions>()(
  persist(
    (set) => ({

      usageCount: 0,
      lastSeenChangelogVersion: 0,
      suppressedItems: {},

      setLastSeenChangelogVersion: (version: number) => set({ lastSeenChangelogVersion: version }),

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

// increment the usage count
useAppStateStore.setState((state) => ({ usageCount: (state.usageCount || 0) + 1 }));
