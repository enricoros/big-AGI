import { create } from 'zustand';
import { persist } from 'zustand/middleware';


/// Settings Store

interface SettingsStore {

  // UI settings

  centerMode: 'narrow' | 'wide' | 'full';
  setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => void;

  freeScroll: boolean;
  setFreeScroll: (freeScroll: boolean) => void;

  renderMarkdown: boolean;
  setRenderMarkdown: (renderMarkdown: boolean) => void;

  showPurposeFinder: boolean;
  setShowPurposeFinder: (showPurposeFinder: boolean) => void;

  showSystemMessages: boolean;
  setShowSystemMessages: (showSystemMessages: boolean) => void;

  zenMode: 'clean' | 'cleaner';
  setZenMode: (zenMode: 'clean' | 'cleaner') => void;

  // OpenAI API settings

  apiKey: string;
  setApiKey: (apiKey: string) => void;

  apiHost: string;
  setApiHost: (apiHost: string) => void;

  apiOrganizationId: string;
  setApiOrganizationId: (apiOrganizationId: string) => void;

  modelTemperature: number;
  setModelTemperature: (modelTemperature: number) => void;

  modelMaxResponseTokens: number;
  setModelMaxResponseTokens: (modelMaxResponseTokens: number) => void;

}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({

      centerMode: 'wide',
      setCenterMode: (centerMode: 'narrow' | 'wide' | 'full') => set({ centerMode }),

      freeScroll: false,
      setFreeScroll: (freeScroll: boolean) => set({ freeScroll }),

      renderMarkdown: false,
      setRenderMarkdown: (renderMarkdown: boolean) => set({ renderMarkdown }),

      showPurposeFinder: false,
      setShowPurposeFinder: (showPurposeFinder: boolean) => set({ showPurposeFinder }),

      showSystemMessages: false,
      setShowSystemMessages: (showSystemMessages: boolean) => set({ showSystemMessages }),

      zenMode: 'clean',
      setZenMode: (zenMode: 'clean' | 'cleaner') => set({ zenMode }),

      apiKey: (function() {
        // this will be removed in April
        if (typeof localStorage === 'undefined') return '';
        return localStorage.getItem('app-settings-openai-api-key') || '';
      })(),
      setApiKey: (apiKey: string) => set({ apiKey }),

      apiHost: '',
      setApiHost: (apiHost: string) => set({ apiHost }),

      apiOrganizationId: '',
      setApiOrganizationId: (apiOrganizationId: string) => set({ apiOrganizationId }),

      modelTemperature: 0.5,
      setModelTemperature: (modelTemperature: number) => set({ modelTemperature }),

      modelMaxResponseTokens: 2048,
      setModelMaxResponseTokens: (modelMaxResponseTokens: number) => set({ modelMaxResponseTokens: modelMaxResponseTokens }),

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