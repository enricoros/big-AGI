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

  // ElevenLabs Text to Speech settings

  elevenLabsApiKey: string;
  setElevenLabsApiKey: (apiKey: string) => void;

  elevenLabsVoiceId: string;
  setElevenLabsVoiceId: (voiceId: string) => void;

  elevenLabsAutoSpeak: 'off' | 'firstLine';
  setElevenLabsAutoSpeak: (autoSpeak: 'off' | 'firstLine') => void;

}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({

      // UI settings

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

      // OpenAI API settings

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

      modelMaxResponseTokens: 1024,
      setModelMaxResponseTokens: (modelMaxResponseTokens: number) => set({ modelMaxResponseTokens: modelMaxResponseTokens }),

      // ElevenLabs Text to Speech settings

      elevenLabsApiKey: '',
      setElevenLabsApiKey: (elevenLabsApiKey: string) => set({ elevenLabsApiKey }),

      elevenLabsVoiceId: '',
      setElevenLabsVoiceId: (elevenLabsVoiceId: string) => set({ elevenLabsVoiceId }),

      elevenLabsAutoSpeak: 'firstLine',
      setElevenLabsAutoSpeak: (elevenLabsAutoSpeak: 'off' | 'firstLine') => set({ elevenLabsAutoSpeak }),

    }),
    {
      name: 'app-settings',
    }),
);


/// Composer Store

interface ComposerStore {

  // state
  sentMessages: {
    date: number,
    text: string,
    count: number,
  }[];

  // actions
  appendSentMessage: (text: string) => void;
  clearSentMessages: () => void;

}

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