import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { persist } from 'zustand/middleware';


export type ChatAutoSpeakType = 'off' | 'firstLine' | 'all';

interface AppChatState {

  // Chat AI

  autoSpeak: ChatAutoSpeakType;
  setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => void;

  autoSuggestDiagrams: boolean,
  setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => void;

  autoSuggestQuestions: boolean,
  setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => void;

  autoTitleChat: boolean;
  setautoTitleChat: (autoTitleChat: boolean) => void;

  // Chat

  showTextDiff: boolean;
  setShowTextDiff: (showTextDiff: boolean) => void;

  showSystemMessages: boolean;
  setShowSystemMessages: (showSystemMessages: boolean) => void;

}

const useAppChatStore = create<AppChatState>()(persist(
  (set) => ({

    // Chat AI

    autoSpeak: 'off',
    setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => set({ autoSpeak }),

    autoSuggestDiagrams: false,
    setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => set({ autoSuggestDiagrams }),

    autoSuggestQuestions: false,
    setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => set({ autoSuggestQuestions }),

    autoTitleChat: true,
    setautoTitleChat: (autoTitleChat: boolean) => set({ autoTitleChat }),

    showTextDiff: false,
    setShowTextDiff: (showTextDiff: boolean) => set({ showTextDiff }),

    showSystemMessages: false,
    setShowSystemMessages: (showSystemMessages: boolean) => set({ showSystemMessages }),

  }), {
    name: 'app-app-chat',

    // for now, let text diff be off by default
    onRehydrateStorage: () => (state) => {
      if (state)
        state.showTextDiff = false;
    },
  },
));


// Chat AI

export const useChatAutoAI = (): {
  autoSpeak: ChatAutoSpeakType,
  autoSuggestDiagrams: boolean,
  autoSuggestQuestions: boolean,
  autoTitleChat: boolean,
  setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => void,
  setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => void,
  setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => void,
  setautoTitleChat: (autoTitleChat: boolean) => void,
} => useAppChatStore(state => ({
  autoSpeak: state.autoSpeak,
  autoSuggestDiagrams: state.autoSuggestDiagrams,
  autoSuggestQuestions: state.autoSuggestQuestions,
  autoTitleChat: state.autoTitleChat,
  setAutoSpeak: state.setAutoSpeak,
  setAutoSuggestDiagrams: state.setAutoSuggestDiagrams,
  setAutoSuggestQuestions: state.setAutoSuggestQuestions,
  setautoTitleChat: state.setautoTitleChat,
}), shallow);

export const getChatAutoAI = (): {
  autoSpeak: ChatAutoSpeakType,
  autoSuggestDiagrams: boolean,
  autoSuggestQuestions: boolean,
  autoTitleChat: boolean,
} => useAppChatStore.getState();

// Chat

export const useChatShowTextDiff = (): [boolean, (showDiff: boolean) => void] =>
  useAppChatStore(state => [state.showTextDiff, state.setShowTextDiff], shallow);

export const getChatShowSystemMessages = (): boolean => useAppChatStore.getState().showSystemMessages;

export const useChatShowSystemMessages = (): [boolean, (showSystemMessages: boolean) => void] =>
  useAppChatStore(state => [state.showSystemMessages, state.setShowSystemMessages], shallow);
