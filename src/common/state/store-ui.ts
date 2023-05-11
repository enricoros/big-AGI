import { create } from 'zustand';


/// UI Store (not persisted)

interface UIStore {

  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;

  modelingOpen: boolean;
  openModeling: () => void;
  closeModeling: () => void;

}

export const useUIStore = create<UIStore>()(
  (set) => ({

    settingsOpen: false,
    closeSettings: () => set({ settingsOpen: false }),
    openSettings: () => set({ settingsOpen: true }),

    modelingOpen: false,
    openModeling: () => set({ modelingOpen: true }),
    closeModeling: () => set({ modelingOpen: false }),

  }),
);
