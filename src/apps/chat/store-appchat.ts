import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { persist } from 'zustand/middleware';


interface AppChatState {

  // Chat AI

  autoSetChatTitle: boolean;
  setAutoSetChatTitle: (autoSetChatTitle: boolean) => void;

  autoSuggestDiagrams: boolean,
  setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => void;

  autoSuggestQuestions: boolean,
  setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => void;

  // Chat

  showTextDiff: boolean;
  setShowTextDiff: (showTextDiff: boolean) => void;

  showSystemMessages: boolean;
  setShowSystemMessages: (showSystemMessages: boolean) => void;

}

const useAppChatStore = create<AppChatState>()(persist(
  (set) => ({

    autoSetChatTitle: true,
    setAutoSetChatTitle: (autoSetChatTitle: boolean) => set({ autoSetChatTitle }),

    autoSuggestDiagrams: false,
    setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => set({ autoSuggestDiagrams }),

    autoSuggestQuestions: false,
    setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => set({ autoSuggestQuestions }),

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
  autoSetChatTitle: boolean,
  autoSuggestDiagrams: boolean,
  autoSuggestQuestions: boolean,
  setAutoSetChatTitle: (autoSetChatTitle: boolean) => void,
  setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => void,
  setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => void
} =>
  useAppChatStore(state => ({
    autoSetChatTitle: state.autoSetChatTitle,
    autoSuggestDiagrams: state.autoSuggestDiagrams,
    autoSuggestQuestions: state.autoSuggestQuestions,
    setAutoSetChatTitle: state.setAutoSetChatTitle,
    setAutoSuggestDiagrams: state.setAutoSuggestDiagrams,
    setAutoSuggestQuestions: state.setAutoSuggestQuestions,
  }), shallow);

export const getChatAutoAI = (): {
  autoSetChatTitle: boolean,
  autoSuggestDiagrams: boolean,
  autoSuggestQuestions: boolean,
} => useAppChatStore.getState();

// Chat

export const useChatShowTextDiff = (): [boolean, (showDiff: boolean) => void] =>
  useAppChatStore(state => [state.showTextDiff, state.setShowTextDiff], shallow);

export const getChatShowSystemMessages = (): boolean => useAppChatStore.getState().showSystemMessages;

export const useChatShowSystemMessages = (): [boolean, (showSystemMessages: boolean) => void] =>
  useAppChatStore(state => [state.showSystemMessages, state.setShowSystemMessages], shallow);
