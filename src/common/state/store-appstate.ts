import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// App State

interface AppStateData {
  usageCount: number;
  lastSeenNewsVersion: number;
  // suppressedItems: Record<string, boolean>;
}

interface AppStateActions {
  setLastSeenNewsVersion: (version: number) => void;
}


export const useAppStateStore = create<AppStateData & AppStateActions>()(
  persist(
    (set) => ({

      usageCount: 0,
      lastSeenNewsVersion: 0,
      // suppressedItems: {},

      setLastSeenNewsVersion: (version: number) => set({ lastSeenNewsVersion: version }),

    }),
    {
      name: 'app-state',
    },
  ),
);

// increment the usage count
useAppStateStore.setState((state) => ({ usageCount: (state.usageCount || 0) + 1 }));
