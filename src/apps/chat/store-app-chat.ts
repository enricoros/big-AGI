import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { persist } from 'zustand/middleware';

import { DConversationId, useChatStore } from '~/common/state/store-chats';


export type ChatAutoSpeakType = 'off' | 'firstLine' | 'all';


// Window Management

interface WindowPane {
  conversationId: DConversationId | null;
  conversationHistory: DConversationId[]; // History of the conversationIds for this pane
  conversationHistoryIndex: number; // Current position in the history for this pane
}

interface WindowManagerSlice {
  windowPanes: WindowPane[];
  windowPaneFocusIndex: number | null;
  windowPanesInputMode: 'focused' | 'broadcast';

  openChatInFocusedPane: (conversationId: DConversationId) => void;
  navigateHistory: (direction: 'back' | 'forward') => void;
  focusPane: (paneIndex: number) => void;
  splitWindow: (numberOfPanes: number) => void;
  unsplitWindow: (paneIndexToKeep: number) => void;
}


// Chat Settings (Chat AI & Chat UI)

interface ChatSettingsSlice {

  autoSpeak: ChatAutoSpeakType;
  setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => void;

  autoSuggestDiagrams: boolean,
  setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => void;

  autoSuggestQuestions: boolean,
  setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => void;

  autoTitleChat: boolean;
  setAutoTitleChat: (autoTitleChat: boolean) => void;

  showTextDiff: boolean;
  setShowTextDiff: (showTextDiff: boolean) => void;

  showSystemMessages: boolean;
  setShowSystemMessages: (showSystemMessages: boolean) => void;

}


type AppChatStore = WindowManagerSlice & ChatSettingsSlice;

const useAppChatStore = create<AppChatStore>()(persist(
  (_set, _get) => ({

    // Window Management

    windowPanes: [],
    windowPaneFocusIndex: null,
    windowPanesInputMode: 'focused',

    openChatInFocusedPane: (conversationId: DConversationId) => {
      _set((state) => {
        let { windowPanes, windowPaneFocusIndex } = state;

        // If there's no pane or no focused pane, create and focus a new one.
        if (windowPanes.length === 0 || windowPaneFocusIndex === null) {
          const newPane = createPane(conversationId);
          return {
            windowPanes: [newPane],
            windowPaneFocusIndex: 0, // Focus the new pane
          };
        }

        // Check if the conversation is already open in the focused pane.
        const focusedPane = windowPanes[windowPaneFocusIndex];
        if (focusedPane.conversationId === conversationId)
          return {};

        // Update the focused pane with the new conversation.
        const newHistory = [...focusedPane.conversationHistory, conversationId];
        windowPanes[windowPaneFocusIndex] = {
          ...focusedPane,
          conversationId,
          conversationHistory: newHistory,
          conversationHistoryIndex: newHistory.length - 1,
        };

        // Return the updated state.
        return {
          windowPanes, // No need to create a new array since we've modified the existing one
        };
      });
    },

    navigateHistory: (direction: 'back' | 'forward') =>
      _set(state => {
        const { windowPanes, windowPaneFocusIndex } = state;
        if (windowPaneFocusIndex === null)
          return state;

        const focusedPane = windowPanes[windowPaneFocusIndex];
        let newHistoryIndex = focusedPane.conversationHistoryIndex;

        if (direction === 'back' && newHistoryIndex > 0)
          newHistoryIndex--;
        else if (direction === 'forward' && newHistoryIndex < focusedPane.conversationHistory.length - 1)
          newHistoryIndex++;

        const newPanes = [...windowPanes];
        newPanes[windowPaneFocusIndex] = {
          ...focusedPane,
          conversationId: focusedPane.conversationHistory[newHistoryIndex],
          conversationHistoryIndex: newHistoryIndex,
        };

        return {
          windowPanes: newPanes,
        };
      }),

    focusPane: (paneIndex: number) =>
      _set({
        windowPaneFocusIndex: paneIndex,
      }),

    splitWindow: (numberOfPanes: number) => {
      const { windowPanes, windowPaneFocusIndex } = _get();
      const focusedPane = windowPaneFocusIndex !== null ? windowPanes[windowPaneFocusIndex] : createPane();

      _set({
        windowPanes: Array.from({ length: numberOfPanes }, () => ({ ...focusedPane })),
        windowPaneFocusIndex: 0,
      });
    },

    unsplitWindow: (paneIndexToKeep: number) =>
      _set(state => ({
        windowPanes: [state.windowPanes[paneIndexToKeep] || createPane()],
        windowPaneFocusIndex: 0,
      })),


    // Settings: Chat AI & Chat UI

    autoSpeak: 'off',
    setAutoSpeak: (autoSpeak: ChatAutoSpeakType) => _set({ autoSpeak }),

    autoSuggestDiagrams: false,
    setAutoSuggestDiagrams: (autoSuggestDiagrams: boolean) => _set({ autoSuggestDiagrams }),

    autoSuggestQuestions: false,
    setAutoSuggestQuestions: (autoSuggestQuestions: boolean) => _set({ autoSuggestQuestions }),

    autoTitleChat: true,
    setAutoTitleChat: (autoTitleChat: boolean) => _set({ autoTitleChat }),

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


// Window Manager

function createPane(conversationId: DConversationId | null = null): WindowPane {
  return {
    conversationId,
    conversationHistory: conversationId ? [conversationId] : [],
    conversationHistoryIndex: conversationId ? 0 : -1,
  };
}

// function initFirstPaneFromChats(): Pick<WindowManagerSlice, 'windowPanes' | 'windowPaneFocusIndex'> {
//   const _ext_conversations = useChatStore.getState().conversations;
//   const firstConversationId = _ext_conversations.length ? _ext_conversations[0].id : null;
//   return {
//     windowPanes: firstConversationId ? [createPane(firstConversationId)] : [],
//     windowPaneFocusIndex: firstConversationId ? 0 : null,
//   };
// }

// if any conversation is deleted from the store, we need to update the window manager
/*useChatStore.subscribe(
  ({ conversations }, { conversations: prevConversations }) => {
    // TODO: autoload the most recent chat?

    // TOOD: monitor deletes to cleanup state across panes

    // if a conversation was deleted, remove it from the window manager
    // if (conversations.length != prevConversations.length)
    //   console.log('TEST', conversations.length, prevConversations.length);
  },
);*/


export const useChatWindowManager = () => useAppChatStore(state => {
  const { windowPaneFocusIndex, windowPanes } = state;
  const currentPane = windowPaneFocusIndex !== null ? windowPanes[windowPaneFocusIndex] : null;
  // console.log('useChatWindowManager', windowPaneFocusIndex, windowPanes, currentPane);
  return {
    currentPane,
    windowPanes: windowPanes as Readonly<WindowPane[]>,
    openChatInFocusedPane: state.openChatInFocusedPane,
    navigateHistory: state.navigateHistory,
    splitWindow: state.splitWindow,
    unsplitWindow: state.unsplitWindow,
    focusPane: state.focusPane,
  };
}, shallow);


// Chat State

export const useChatAutoAI = () => useAppChatStore(state => ({
  autoSpeak: state.autoSpeak,
  autoSuggestDiagrams: state.autoSuggestDiagrams,
  autoSuggestQuestions: state.autoSuggestQuestions,
  autoTitleChat: state.autoTitleChat,
  setAutoSpeak: state.setAutoSpeak,
  setAutoSuggestDiagrams: state.setAutoSuggestDiagrams,
  setAutoSuggestQuestions: state.setAutoSuggestQuestions,
  setAutoTitleChat: state.setAutoTitleChat,
}), shallow);

export const getChatAutoAI = (): {
  autoSpeak: ChatAutoSpeakType,
  autoSuggestDiagrams: boolean,
  autoSuggestQuestions: boolean,
  autoTitleChat: boolean,
} => useAppChatStore.getState();

export const useChatShowTextDiff = (): [boolean, (showDiff: boolean) => void] =>
  useAppChatStore(state => [state.showTextDiff, state.setShowTextDiff], shallow);

export const getChatShowSystemMessages = (): boolean => useAppChatStore.getState().showSystemMessages;

export const useChatShowSystemMessages = (): [boolean, (showSystemMessages: boolean) => void] =>
  useAppChatStore(state => [state.showSystemMessages, state.setShowSystemMessages], shallow);
