import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { GptChatModel } from '../components/Settings';
import { SystemPurpose } from '../pages';


/// Settings Store

interface SettingsState {
  // apiKey: string;
  // setApiKey: (apiKey: string) => void;

  chatModel: GptChatModel;
  setChatModel: (chatModel: GptChatModel) => void;

  systemPurpose: SystemPurpose;
  setSystemPurpose: (purpose: SystemPurpose) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist((set) => ({
      // apiKey: '',
      chatModel: 'gpt-4',
      systemPurpose: 'Developer',

      // setApiKey: (apiKey: string) => set({ apiKey }),
      setChatModel: (chatModel: GptChatModel) => set({ chatModel }),
      setSystemPurpose: (purpose: SystemPurpose) => set({ systemPurpose: purpose }),
    }),
    {
      name: 'app-settings',
    }),
);


/// Composer Store

export interface HistoryItem {
  date: number,
  text: string,
  count: number,
}

interface ComposerState {
  history: HistoryItem[];
  appendMessageToHistory: (text: string) => void;
}

export const useComposerStore = create<ComposerState>()(
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