import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/// Composer Store

interface ComposerStore {

  sentMessages: {
    date: number,
    text: string,
    count: number,
  }[];
  appendSentMessage: (text: string) => void;
  clearSentMessages: () => void;

  startupText: string | null;
  setStartupText: (text: string | null) => void;

}

const MAX_SENT_MESSAGES_HISTORY = 16;

export const useComposerStore = create<ComposerStore>()(
  persist((set, get) => ({

      sentMessages: [],
      appendSentMessage: (text: string) => {
        const date = Date.now();
        const list = [...(get().sentMessages || [])];

        // take the item from the array, matching by text
        let item = list.find((item) => item.text === text);
        if (item) {
          list.splice(list.indexOf(item), 1);
          item.date = date;
          item.count++;
        } else
          item = { date, text, count: 1 };

        // prepend the item
        list.unshift(item);

        // update the store (limiting max items)
        set({ sentMessages: list.slice(0, MAX_SENT_MESSAGES_HISTORY) });
      },
      clearSentMessages: () => set({ sentMessages: [] }),

      startupText: null,
      setStartupText: (text: string | null) => set({ startupText: text }),

    }),
    {
      name: 'app-composer',
      version: 1,
      migrate: (state: any, version): ComposerStore => {
        // 0 -> 1: rename history to sentMessages
        if (state && version === 0) {
          state.sentMessages = state.history;
          delete state.history;
        }
        return state as ComposerStore;
      },
    }),
);