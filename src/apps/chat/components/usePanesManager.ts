import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

import { DConversationId, useChatStore } from '~/common/state/store-chats';


// change this to increase/decrease the number history steps per pane
const MAX_HISTORY_LENGTH = 20;


interface ChatPane {

  conversationId: DConversationId | null;

  history: DConversationId[]; // History of the conversationIds for this pane
  historyIndex: number; // Current position in the history for this pane

}

interface AppChatPanesStore {

  // state
  chatPanes: ChatPane[];
  chatPaneFocusIndex: number | null;
  chatPaneInputMode: 'focused' | 'broadcast';

  // actions
  openConversationInFocusedPane: (conversationId: DConversationId) => void;
  focusChatPane: (paneIndex: number) => void;
  splitChatPane: (numberOfPanes: number) => void;
  unsplitChatPane: (paneIndexToKeep: number) => void;
  navigateHistory: (direction: 'back' | 'forward') => void;
  onConversationsChanged: (conversationIds: DConversationId[]) => void;

}

function createPane(conversationId: DConversationId | null = null): ChatPane {
  return {
    conversationId,
    history: conversationId ? [conversationId] : [],
    historyIndex: conversationId ? 0 : -1,
  };
}

const useAppChatPanesStore = create<AppChatPanesStore>()(persist(
  (_set, _get) => ({

    // Initial state: no panes
    chatPanes: [] as ChatPane[],
    chatPaneFocusIndex: null as number | null,
    chatPaneInputMode: 'focused' as 'focused' | 'broadcast',

    openConversationInFocusedPane: (conversationId: DConversationId) => {
      _set((state) => {
        const { chatPanes, chatPaneFocusIndex } = state;

        // If there's no pane or no focused pane, create and focus a new one.
        if (!chatPanes.length || chatPaneFocusIndex === null) {
          const newPane = createPane(conversationId);
          return {
            chatPanes: [newPane],
            chatPaneFocusIndex: 0, // Focus the new pane
          };
        }

        // Check if the conversation is already open in the focused pane.
        const focusedPane = chatPanes[chatPaneFocusIndex];
        if (focusedPane.conversationId === conversationId)
          return state;

        // Update the focused pane with the new conversation.
        const newPanes = [...chatPanes];
        const newHistory = [...focusedPane.history, conversationId].slice(-MAX_HISTORY_LENGTH);
        newPanes[chatPaneFocusIndex] = {
          ...focusedPane,
          conversationId,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };

        // Return the updated state.
        return {
          chatPanes: newPanes,
        };
      });
    },

    focusChatPane: (paneIndex: number) =>
      _set({
        chatPaneFocusIndex: paneIndex,
      }),

    splitChatPane: (numberOfPanes: number) => {
      const { chatPanes, chatPaneFocusIndex } = _get();
      const focusedPane = (chatPaneFocusIndex !== null ? chatPanes[chatPaneFocusIndex] : null) ?? createPane();

      _set({
        chatPanes: Array.from({ length: numberOfPanes }, () => ({ ...focusedPane })),
        chatPaneFocusIndex: 0,
      });
    },

    unsplitChatPane: (paneIndexToKeep: number) =>
      _set(state => ({
        chatPanes: [state.chatPanes[paneIndexToKeep] || createPane()],
        chatPaneFocusIndex: 0,
      })),

    navigateHistory: (direction: 'back' | 'forward') =>
      _set(state => {
        const { chatPanes, chatPaneFocusIndex } = state;
        if (chatPaneFocusIndex === null)
          return state;

        const focusedPane = chatPanes[chatPaneFocusIndex];
        let newHistoryIndex = focusedPane.historyIndex;

        if (direction === 'back' && newHistoryIndex > 0)
          newHistoryIndex--;
        else if (direction === 'forward' && newHistoryIndex < focusedPane.history.length - 1)
          newHistoryIndex++;

        const newPanes = [...chatPanes];
        newPanes[chatPaneFocusIndex] = {
          ...focusedPane,
          conversationId: focusedPane.history[newHistoryIndex],
          historyIndex: newHistoryIndex,
        };

        return {
          chatPanes: newPanes,
        };
      }),

    /**
     * This function is vital, as is invoked when the conversationId[] changes in the global chats store.
     * It takes care of `creating the first pane` as well as `removing invalid history items, reassiging
     * conversationIds, and re-focusing the pane`.
     */
    onConversationsChanged: (conversationIds: DConversationId[]) =>
      _set(state => {
        const { chatPanes, chatPaneFocusIndex } = state;

        // handle panes
        let untouched = true;
        const newPanes: ChatPane[] = chatPanes.map(chatPane => {
          const { conversationId, history, historyIndex } = chatPane;

          // adjust history if any is deleted
          let newHistoryIndex = historyIndex;
          const newHistory = history.filter((_hId, index) => {
            const historyStillPresent = conversationIds.includes(_hId);
            if (!historyStillPresent && index <= historyIndex)
              newHistoryIndex--;
            return historyStillPresent;
          });
          if (newHistoryIndex < 0 && newHistory.length > 0)
            newHistoryIndex = 0;

          // check if pointing to a valid conversationId
          const needsNewConversationId = !conversationId || !conversationIds.includes(conversationId);
          if (!needsNewConversationId && newHistory.length === history.length)
            return chatPane;

          const nextConversationId = newHistoryIndex >= 0 && newHistoryIndex < newHistory.length
            ? newHistory[newHistoryIndex]
            : newHistory.length > 0
              ? newHistory[newHistory.length - 1]
              : conversationIds[0] ?? null;

          untouched = false;
          return {
            ...chatPane,
            conversationId: nextConversationId,
            history: newHistory,
            historyIndex: newHistoryIndex,
          };
        }).filter(pane => !!pane.conversationId);

        // if untouched, return state as-is
        if (untouched && newPanes.length >= 1)
          return state;

        // play it safe, and make sure a pane exists, and is focused
        return {
          chatPanes: newPanes.length ? newPanes : [createPane(conversationIds[0] ?? null)],
          chatPaneFocusIndex: (newPanes.length && chatPaneFocusIndex !== null && chatPaneFocusIndex < newPanes.length) ? state.chatPaneFocusIndex : 0,
        };
      }),

  }), {
    name: 'app-app-chat-panes',
  },
));


export function usePanesManager() {
  // use Panes
  const { focusedChatPane, openConversationInFocusedPane, onConversationsChanged } = useAppChatPanesStore(state => {
    const { chatPaneFocusIndex, chatPanes, openConversationInFocusedPane, onConversationsChanged } = state;
    const focusedChatPane = chatPaneFocusIndex !== null ? chatPanes[chatPaneFocusIndex] ?? null : null;
    return {
      // chatPanes: chatPanes as Readonly<ChatPane[]>,
      focusedChatPane,
      openConversationInFocusedPane,
      onConversationsChanged,
    };
  }, shallow);

  // use Conversation IDs[]
  const conversationIDs: DConversationId[] = useChatStore(state => {
    return state.conversations.map(_c => _c.id);
  }, shallow);

  // [Effect] Ensure all Panes have a valid Conversation ID
  React.useEffect(() => {
    onConversationsChanged(conversationIDs);
  }, [conversationIDs, onConversationsChanged]);

  return {
    focusedChatPane,
    openConversationInFocusedPane,
  };
}