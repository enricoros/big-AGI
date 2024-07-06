import { create } from 'zustand';
import { persist } from 'zustand/middleware';


// App State

interface AppStateData {
  usageCount: number;
}

export const useAppStateStore = create<AppStateData>()(
  persist(
    (set) => ({

      usageCount: 0,

    }),
    {
      name: 'app-state',
    },
  ),
);

// increment the usage count
useAppStateStore.setState((state) => ({ usageCount: (state.usageCount || 0) + 1 }));
