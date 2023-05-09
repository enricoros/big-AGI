import { create } from 'zustand';


/// UI Store (not persisted)

interface UIStore {

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

}

export const useUIStore = create<UIStore>()(
  (set) => ({

    // default state
    settingsOpen: false,
    closeSettings: () => set({ settingsOpen: false }),
    openSettings: () => set({ settingsOpen: true }),

  }),
);
