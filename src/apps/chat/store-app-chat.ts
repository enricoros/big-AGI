import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';


export type ChatAutoSpeakType = 'off' | 'firstLine' | 'all';


// Chat Settings (Chat AI & Chat UI)

interface AppChatStore {

  // chat AI

  autoSpeak: ChatAutoSpeakType;
  setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => void;

  autoSuggestDiagrams: boolean,
  setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => void;

  autoSuggestHTMLUI: boolean;
  setAutoSuggestHTMLUI: (autoSuggestHTMLUI: boolean) => void;

  autoSuggestQuestions: boolean,
  setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => void;

  autoTitleChat: boolean;
  setAutoTitleChat: (autoTitleChat: boolean) => void;

  // chat UI

  filterHasDocFragments: boolean;
  setFilterHasDocFragments: (filterHasDocFragments: boolean) => void;

  filterHasImageAssets: boolean;
  setFilterHasImageAssets: (filterHasImageAssets: boolean) => void;

  filterHasStars: boolean;
  setFilterHasStars: (filterHasStars: boolean) => void;

  micTimeoutMs: number;
  setMicTimeoutMs: (micTimeoutMs: number) => void;

  showPersonaIcons: boolean;
  setShowPersonaIcons: (showPersonaIcons: boolean) => void;

  showRelativeSize: boolean;
  setShowRelativeSize: (showRelativeSize: boolean) => void;

  showTextDiff: boolean;
  setShowTextDiff: (showTextDiff: boolean) => void;

  showSystemMessages: boolean;
  setShowSystemMessages: (showSystemMessages: boolean) => void;

}


const useAppChatStore = create<AppChatStore>()(persist(
  (_set, _get) => ({

    autoSpeak: 'off',
    setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => _set({ autoSpeak }),

    autoSuggestDiagrams: false,
    setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => _set({ autoSuggestDiagrams }),

    autoSuggestHTMLUI: false,
    setAutoSuggestHTMLUI: (autoSuggestHTMLUI: boolean) => _set({ autoSuggestHTMLUI }),

    autoSuggestQuestions: false,
    setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => _set({ autoSuggestQuestions }),

    autoTitleChat: true,
    setAutoTitleChat: (autoTitleChat: boolean) => _set({ autoTitleChat }),

    filterHasDocFragments: false,
    setFilterHasDocFragments: (filterHasDocFragments: boolean) => _set({ filterHasDocFragments }),

    filterHasImageAssets: false,
    setFilterHasImageAssets: (filterHasImageAssets: boolean) => _set({ filterHasImageAssets }),

    filterHasStars: false,
    setFilterHasStars: (filterHasStars: boolean) => _set({ filterHasStars }),

    micTimeoutMs: 2000,
    setMicTimeoutMs: (micTimeoutMs: number) => _set({ micTimeoutMs }),

    showPersonaIcons: true,
    setShowPersonaIcons: (showPersonaIcons: boolean) => _set({ showPersonaIcons }),

    showRelativeSize: false,
    setShowRelativeSize: (showRelativeSize: boolean) => _set({ showRelativeSize }),

    showTextDiff: false,
    setShowTextDiff: (showTextDiff: boolean) => _set({ showTextDiff }),

    showSystemMessages: false,
    setShowSystemMessages: (showSystemMessages: boolean) => _set({ showSystemMessages }),

  }), {
    name: 'app-app-chat',
    version: 1,

    onRehydrateStorage: () => (state) => {
      if (!state) return;

      // for now, let text diff be off by default
      state.showTextDiff = false;
    },

    migrate: (state: any, fromVersion: number): AppChatStore => {
      // 0 -> 1: autoTitleChat was off by mistake - turn it on [Remove past Dec 1, 2023]
      if (state && fromVersion < 1)
        state.autoTitleChat = true;
      return state;
    },
  },
));


export const useChatAutoAI = () => useAppChatStore(useShallow(state => ({
  autoSpeak: state.autoSpeak,
  autoSuggestDiagrams: state.autoSuggestDiagrams,
  autoSuggestHTMLUI: state.autoSuggestHTMLUI,
  autoSuggestQuestions: state.autoSuggestQuestions,
  autoTitleChat: state.autoTitleChat,
  setAutoSpeak: state.setAutoSpeak,
  setAutoSuggestDiagrams: state.setAutoSuggestDiagrams,
  setAutoSuggestHTMLUI: state.setAutoSuggestHTMLUI,
  setAutoSuggestQuestions: state.setAutoSuggestQuestions,
  setAutoTitleChat: state.setAutoTitleChat,
})));

export const getChatAutoAI = (): {
  autoSpeak: ChatAutoSpeakType,
  autoSuggestDiagrams: boolean,
  autoSuggestHTMLUI: boolean,
  autoSuggestQuestions: boolean,
  autoTitleChat: boolean,
} => useAppChatStore.getState();

export const useChatAutoSuggestHTMLUI = (): boolean =>
  useAppChatStore(state => state.autoSuggestHTMLUI);

export const useChatMicTimeoutMsValue = (): number =>
  useAppChatStore(state => state.micTimeoutMs);

export const useChatMicTimeoutMs = (): [number, (micTimeoutMs: number) => void] =>
  useAppChatStore(useShallow(state => [state.micTimeoutMs, state.setMicTimeoutMs]));

export const useChatDrawerFilters = () => {
  const values = useAppChatStore(useShallow(state => ({
    filterHasDocFragments: state.filterHasDocFragments,
    filterHasImageAssets: state.filterHasImageAssets,
    filterHasStars: state.filterHasStars,
    showPersonaIcons: state.showPersonaIcons,
    showRelativeSize: state.showRelativeSize,
  })));
  return {
    ...values,
    toggleFilterHasDocFragments: () => useAppChatStore.getState().setFilterHasDocFragments(!values.filterHasDocFragments),
    toggleFilterHasImageAssets: () => useAppChatStore.getState().setFilterHasImageAssets(!values.filterHasImageAssets),
    toggleFilterHasStars: () => useAppChatStore.getState().setFilterHasStars(!values.filterHasStars),
    toggleShowPersonaIcons: () => useAppChatStore.getState().setShowPersonaIcons(!values.showPersonaIcons),
    toggleShowRelativeSize: () => useAppChatStore.getState().setShowRelativeSize(!values.showRelativeSize),
  };
};

export const useChatShowTextDiff = (): [boolean, (showDiff: boolean) => void] =>
  useAppChatStore(useShallow(state => [state.showTextDiff, state.setShowTextDiff]));

export const getChatShowSystemMessages = (): boolean =>
  useAppChatStore.getState().showSystemMessages;

export const useChatShowSystemMessages = (): [boolean, (showSystemMessages: boolean) => void] =>
  useAppChatStore(useShallow(state => [state.showSystemMessages, state.setShowSystemMessages]));
