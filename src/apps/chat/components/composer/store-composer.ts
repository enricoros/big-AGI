import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/// Composer Store

interface ComposerStore {

  startupText: string | null;
  setStartupText: (text: string | null) => void;

}

// const MAX_SENT_MESSAGES_HISTORY = 16;

export const useComposerStore = create<ComposerStore>()(
  persist((set, _get) => ({

      startupText: null,
      setStartupText: (text: string | null) => set({ startupText: text }),

    }),
    {
      name: 'app-composer',
      version: 1,
      /*migrate: (state: any, version): ComposerStore => {
        // 0 -> 1: rename history to sentMessages
        if (state && version === 0) {
          state.sentMessages = state.history;
          delete state.history;
        }
        return state as ComposerStore;
      },*/
    }),
);