import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultSendModeId, SendModeId } from '../../data';


/// Composer Store

interface ComposerStore {

  sendModeId: SendModeId;
  setSendModeId: (sendMode: SendModeId) => void;

  sentMessages: {
    date: number,
    text: string,
    count: number,
  }[];
  appendSentMessage: (text: string) => void;
  clearSentMessages: () => void;

}

export const useComposerStore = create<ComposerStore>()(
  persist((set, get) => ({

      sendModeId: defaultSendModeId,
      setSendModeId: (sendMode: SendModeId) => set({ sendModeId: sendMode }),

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
        set({ sentMessages: list.slice(0, 20) });
      },
      clearSentMessages: () => set({ sentMessages: [] }),

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
