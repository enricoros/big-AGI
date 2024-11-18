import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import type { DLLMId } from '~/common/stores/llms/llms.types';


export type ChatAutoSpeakType = 'off' | 'firstLine' | 'all';


// Chat Settings (Chat AI & Chat UI)

interface AppChatStore {

  // chat AI

  autoSpeak: ChatAutoSpeakType;
  setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => void;

  autoSuggestAttachmentPrompts: boolean;
  setAutoSuggestAttachmentPrompts: (autoSuggestAttachmentPrompts: boolean) => void;

  autoSuggestDiagrams: boolean,
  setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => void;

  autoSuggestHTMLUI: boolean;
  setAutoSuggestHTMLUI: (autoSuggestHTMLUI: boolean) => void;

  autoSuggestQuestions: boolean,
  setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => void;

  autoTitleChat: boolean;
  setAutoTitleChat: (autoTitleChat: boolean) => void;

  autoVndAntBreakpoints: boolean;
  setAutoVndAntBreakpoints: (autoVndAntBreakpoints: boolean) => void;

  // chat UI

  clearFilters: () => void;

  filterHasDocFragments: boolean;
  setFilterHasDocFragments: (filterHasDocFragments: boolean) => void;

  filterHasImageAssets: boolean;
  setFilterHasImageAssets: (filterHasImageAssets: boolean) => void;

  filterHasStars: boolean;
  setFilterHasStars: (filterHasStars: boolean) => void;

  micTimeoutMs: number;
  setMicTimeoutMs: (micTimeoutMs: number) => void;

  showPersonaIcons2: boolean;
  setShowPersonaIcons: (showPersonaIcons: boolean) => void;

  showRelativeSize: boolean;
  setShowRelativeSize: (showRelativeSize: boolean) => void;

  showTextDiff: boolean;
  setShowTextDiff: (showTextDiff: boolean) => void;

  showSystemMessages: boolean;
  setShowSystemMessages: (showSystemMessages: boolean) => void;

  // other chat-specific configuration

  notificationEnabledModelIds: DLLMId[];
  setNotificationEnabledForModel: (modelId: DLLMId, enabled: boolean) => void;
  isNotificationEnabledForModel: (modelId: DLLMId) => boolean;

}


const useAppChatStore = create<AppChatStore>()(persist(
  (_set, _get) => ({

    // Chat AI

    autoSpeak: 'off',
    setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => _set({ autoSpeak }),

    autoSuggestAttachmentPrompts: false,
    setAutoSuggestAttachmentPrompts: (autoSuggestAttachmentPrompts: boolean) => _set({ autoSuggestAttachmentPrompts }),

    autoSuggestDiagrams: false,
    setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => _set({ autoSuggestDiagrams }),

    autoSuggestHTMLUI: false,
    setAutoSuggestHTMLUI: (autoSuggestHTMLUI: boolean) => _set({ autoSuggestHTMLUI }),

    autoSuggestQuestions: false,
    setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => _set({ autoSuggestQuestions }),

    autoTitleChat: true,
    setAutoTitleChat: (autoTitleChat: boolean) => _set({ autoTitleChat }),

    autoVndAntBreakpoints: true, // 2024-08-24: on as it saves user's money
    setAutoVndAntBreakpoints: (autoVndAntBreakpoints: boolean) => _set({ autoVndAntBreakpoints }),

    // Chat UI

    clearFilters: () => _set({ filterHasDocFragments: false, filterHasImageAssets: false, filterHasStars: false }),

    filterHasDocFragments: false,
    setFilterHasDocFragments: (filterHasDocFragments: boolean) => _set({ filterHasDocFragments }),

    filterHasImageAssets: false,
    setFilterHasImageAssets: (filterHasImageAssets: boolean) => _set({ filterHasImageAssets }),

    filterHasStars: false,
    setFilterHasStars: (filterHasStars: boolean) => _set({ filterHasStars }),

    micTimeoutMs: 2000,
    setMicTimeoutMs: (micTimeoutMs: number) => _set({ micTimeoutMs }),

    // new default on 2024-11-18: disable icons by default, too confusing
    showPersonaIcons2: false,
    setShowPersonaIcons: (showPersonaIcons: boolean) => _set({ showPersonaIcons2: showPersonaIcons }),

    showRelativeSize: false,
    setShowRelativeSize: (showRelativeSize: boolean) => _set({ showRelativeSize }),

    showTextDiff: false,
    setShowTextDiff: (showTextDiff: boolean) => _set({ showTextDiff }),

    showSystemMessages: false,
    setShowSystemMessages: (showSystemMessages: boolean) => _set({ showSystemMessages }),

    // Other chat-specific configuration

    notificationEnabledModelIds: [],
    setNotificationEnabledForModel: (modelId: DLLMId, enabled: boolean) => {
      const notificationEnabledModelIds = _get().notificationEnabledModelIds;
      if (!enabled)
        _set({ notificationEnabledModelIds: notificationEnabledModelIds.filter(id => id !== modelId) });
      else if (!notificationEnabledModelIds.includes(modelId))
        _set({ notificationEnabledModelIds: [...notificationEnabledModelIds, modelId] });
    },
    isNotificationEnabledForModel: (modelId: DLLMId) => _get().notificationEnabledModelIds.includes(modelId),

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
  autoSuggestAttachmentPrompts: state.autoSuggestAttachmentPrompts,
  autoSuggestDiagrams: state.autoSuggestDiagrams,
  autoSuggestHTMLUI: state.autoSuggestHTMLUI,
  autoSuggestQuestions: state.autoSuggestQuestions,
  autoTitleChat: state.autoTitleChat,
  autoVndAntBreakpoints: state.autoVndAntBreakpoints,
  setAutoSpeak: state.setAutoSpeak,
  setAutoSuggestAttachmentPrompts: state.setAutoSuggestAttachmentPrompts,
  setAutoSuggestDiagrams: state.setAutoSuggestDiagrams,
  setAutoSuggestHTMLUI: state.setAutoSuggestHTMLUI,
  setAutoSuggestQuestions: state.setAutoSuggestQuestions,
  setAutoTitleChat: state.setAutoTitleChat,
  setAutoVndAntBreakpoints: state.setAutoVndAntBreakpoints,
})));

export const getChatAutoAI = (): {
  autoSpeak: ChatAutoSpeakType,
  autoSuggestAttachmentPrompts: boolean,
  autoSuggestDiagrams: boolean,
  autoSuggestHTMLUI: boolean,
  autoSuggestQuestions: boolean,
  autoTitleChat: boolean,
  autoVndAntBreakpoints: boolean,
} => useAppChatStore.getState();

export const useChatAutoSuggestHTMLUI = (): boolean =>
  useAppChatStore(state => state.autoSuggestHTMLUI);

export const useChatAutoSuggestAttachmentPrompts = (): boolean =>
  useAppChatStore(state => state.autoSuggestAttachmentPrompts);

export const useChatMicTimeoutMsValue = (): number =>
  useAppChatStore(state => state.micTimeoutMs);

export const useChatMicTimeoutMs = (): [number, (micTimeoutMs: number) => void] =>
  useAppChatStore(useShallow(state => [state.micTimeoutMs, state.setMicTimeoutMs]));

export const useChatDrawerFilters = () => {
  const values = useAppChatStore(useShallow(state => ({
    filterHasDocFragments: state.filterHasDocFragments,
    filterHasImageAssets: state.filterHasImageAssets,
    filterHasStars: state.filterHasStars,
    showPersonaIcons: state.showPersonaIcons2,
    showRelativeSize: state.showRelativeSize,
  })));
  const chatStoreState = useAppChatStore.getState();
  return {
    ...values,
    clearFilters: chatStoreState.clearFilters,
    toggleFilterHasDocFragments: () => chatStoreState.setFilterHasDocFragments(!values.filterHasDocFragments),
    toggleFilterHasImageAssets: () => chatStoreState.setFilterHasImageAssets(!values.filterHasImageAssets),
    toggleFilterHasStars: () => chatStoreState.setFilterHasStars(!values.filterHasStars),
    toggleShowPersonaIcons: () => chatStoreState.setShowPersonaIcons(!values.showPersonaIcons),
    toggleShowRelativeSize: () => chatStoreState.setShowRelativeSize(!values.showRelativeSize),
  };
};

export const useChatShowTextDiff = (): [boolean, (showDiff: boolean) => void] =>
  useAppChatStore(useShallow(state => [state.showTextDiff, state.setShowTextDiff]));

export const getChatShowSystemMessages = (): boolean =>
  useAppChatStore.getState().showSystemMessages;

export const useChatShowSystemMessages = (): [boolean, (showSystemMessages: boolean) => void] =>
  useAppChatStore(useShallow(state => [state.showSystemMessages, state.setShowSystemMessages]));

export const getIsNotificationEnabledForModel = (modelId: DLLMId): boolean =>
  useAppChatStore.getState().isNotificationEnabledForModel(modelId);

export const setIsNotificationEnabledForModel = (modelId: DLLMId, enabled: boolean) =>
  useAppChatStore.getState().setNotificationEnabledForModel(modelId, enabled);
