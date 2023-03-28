import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { ChatModelId, SystemPurposeId } from './data';


/// Settings Store

interface SettingsStore {
  apiKey: string;
  setApiKey: (apiKey: string) => void;

  chatModelId: ChatModelId;
  setChatModelId: (chatModel: ChatModelId) => void;

  systemPurposeId: SystemPurposeId;
  setSystemPurposeId: (purpose: SystemPurposeId) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist((set) => ({
      apiKey: (function() {
        // backwards compatibility from the former localStorage key
        if (typeof localStorage === 'undefined') return '';
        return localStorage.getItem('app-settings-openai-api-key') || '';
      })(),
      chatModelId: 'gpt-4',
      systemPurposeId: 'Developer',

      setApiKey: (apiKey: string) => set({ apiKey }),
      setChatModelId: (chatModelId: ChatModelId) => set({ chatModelId }),
      setSystemPurposeId: (systemPurposeId: SystemPurposeId) => set({ systemPurposeId }),
    }),
    {
      name: 'app-settings',
    }),
);


/// Composer Store

interface ComposerStore {
  history: {
    date: number,
    text: string,
    count: number,
  }[];

  appendMessageToHistory: (text: string) => void;
}

export const useComposerStore = create<ComposerStore>()(
  persist((set, get) => ({
      history: [],

      appendMessageToHistory: (text: string) => {
        const date = Date.now();
        const history = [...(get().history || [])];

        // take the item from the array, matching by text
        let item = history.find((item) => item.text === text);
        if (item) {
          history.splice(history.indexOf(item), 1);
          item.date = date;
          item.count++;
        } else
          item = { date, text, count: 1 };

        // prepend the item to the history array
        history.unshift(item);

        // update the store (limiting max items)
        set({ history: history.slice(0, 20) });
      },
    }),
    {
      name: 'app-composer',
    }),
);