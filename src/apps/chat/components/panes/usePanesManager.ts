import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

import { DConversationId, useChatStore } from '~/common/state/store-chats';


// change this to increase/decrease the number history steps per pane
const MAX_HISTORY_LENGTH = 10;

// change to true to enable verbose console logging
const DEBUG_PANES_MANAGER = false;


interface ChatPane {

  conversationId: DConversationId | null;

  history: DConversationId[]; // History of the conversationIds for this pane
  historyIndex: number; // Current position in the history for this pane

}

interface AppChatPanesStore {

  // state
  chatPanes: ChatPane[];
  chatPaneFocusIndex: number | null;

  // actions
  openConversationInFocusedPane: (conversationId: DConversationId) => void;
  openConversationInSplitPane: (conversationId: DConversationId) => void;
  navigateHistoryInFocusedPane: (direction: 'back' | 'forward') => boolean;
  duplicateFocusedPane: (/*paneIndex: number*/) => void;
  removeOtherPanes: () => void;
  removePane: (paneIndex: number) => void;
  setFocusedPane: (paneIndex: number) => void;
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
        if (focusedPane.conversationId === conversationId) {
          if (DEBUG_PANES_MANAGER)
            console.log(`open-focuses: ${conversationId} is open in focused pane`, chatPaneFocusIndex, chatPanes);
          return state;
        }

        // Truncate the future history before adding the new conversation.
        const truncatedHistory = focusedPane.history.slice(0, focusedPane.historyIndex + 1);
        const newHistory = [...truncatedHistory, conversationId].slice(-MAX_HISTORY_LENGTH);

        // Update the focused pane with the new conversation.
        const newPanes = [...chatPanes];
        newPanes[chatPaneFocusIndex] = {
          ...focusedPane,
          conversationId,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };

        if (DEBUG_PANES_MANAGER)
          console.log(`open-focuses: set ${conversationId} in focused pane`, chatPaneFocusIndex, chatPanes);

        // Return the updated state.
        return {
          chatPanes: newPanes,
        };
      });
    },

    openConversationInSplitPane: (conversationId: DConversationId) => {
      // Open a conversation in a new pane, reusing an existing pane if possible.
      const { chatPanes, chatPaneFocusIndex, openConversationInFocusedPane } = _get();

      // one pane open: split it
      if (chatPanes.length === 1) {
        _set({
          chatPanes: Array.from({ length: 2 }, () => ({ ...chatPanes[0] })),
          chatPaneFocusIndex: 1,
        });
      }
      // more than 2 panes, reuse the alt pane
      else if (chatPanes.length >= 2 && chatPaneFocusIndex !== null) {
        _set({
          chatPaneFocusIndex: chatPaneFocusIndex === 0 ? 1 : 0,
        });
      }

      // will create a pane if none exists, or load the conversation in the focused pane
      openConversationInFocusedPane(conversationId);

      if (DEBUG_PANES_MANAGER)
        console.log(`open-split-pane: after:`, _get().chatPanes);
    },

    navigateHistoryInFocusedPane: (direction: 'back' | 'forward'): boolean => {
      const { chatPanes, chatPaneFocusIndex } = _get();
      if (chatPaneFocusIndex === null)
        return false;

      const focusedPane = chatPanes[chatPaneFocusIndex];
      let newHistoryIndex = focusedPane.historyIndex;

      if (direction === 'back' && newHistoryIndex > 0)
        newHistoryIndex--;
      else if (direction === 'forward' && newHistoryIndex < focusedPane.history.length - 1)
        newHistoryIndex++;
      else {
        if (DEBUG_PANES_MANAGER)
          console.log(`navigateHistoryInFocusedPane: no history ${direction} for`, focusedPane);
        return false;
      }

      const newPanes = [...chatPanes];
      newPanes[chatPaneFocusIndex] = {
        ...focusedPane,
        conversationId: focusedPane.history[newHistoryIndex],
        historyIndex: newHistoryIndex,
      };

      if (DEBUG_PANES_MANAGER)
        console.log(`navigateHistoryInFocusedPane: ${direction} to`, focusedPane, newPanes);

      _set({
        chatPanes: newPanes,
      });

      return true;
    },

    duplicateFocusedPane: (/*paneIndex: number*/) =>
      _set(state => {
        const { chatPanes, chatPaneFocusIndex: _srcIndex } = state;

        // Validate index
        if (_srcIndex === null || _srcIndex < 0 || _srcIndex >= chatPanes.length) {
          console.warn('Attempted to duplicate a pane with an out-of-range index:', _srcIndex);
          return state; // Return the existing state without changes
        }

        // Clone the pane at the specified index, including a deep copy of the history array
        const paneToDuplicate = chatPanes[_srcIndex];
        const duplicatedPane = {
          ...paneToDuplicate,
          history: [...paneToDuplicate.history], // Deep copy of the history array
        };

        // Insert the duplicated pane into the array, right after the original pane
        const newPanes = [
          ...chatPanes.slice(0, _srcIndex + 1),
          duplicatedPane,
          ...chatPanes.slice(_srcIndex + 1),
        ];

        return {
          chatPanes: newPanes,
          chatPaneFocusIndex: _srcIndex + 1,
        };
      }),

    removeOtherPanes: () =>
      _set(state => {
        const { chatPanes, chatPaneFocusIndex } = state;
        if (chatPanes.length < 2)
          return state;

        const newPanes = [chatPanes[chatPaneFocusIndex ?? 0]];
        return {
          chatPanes: newPanes,
          chatPaneFocusIndex: 0,
        };
      }),

    removePane: (paneIndex: number) =>
      _set(state => {
        const { chatPanes } = state;
        if (paneIndex < 0 || paneIndex >= chatPanes.length)
          return state;

        const newPanes = chatPanes.toSpliced(paneIndex, 1);

        // when a pane is removed, focus the pane 0, or null if no panes remain
        return {
          chatPanes: newPanes,
          chatPaneFocusIndex: newPanes.length ? 0 : null,
        };
      }),

    setFocusedPane: (paneIndex: number) =>
      _set(state => {
        if (state.chatPaneFocusIndex === paneIndex)
          return state;
        return {
          chatPaneFocusIndex: paneIndex >= 0 && paneIndex < state.chatPanes.length ? paneIndex : null,
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
          chatPaneFocusIndex: (newPanes.length && chatPaneFocusIndex !== null && chatPaneFocusIndex < newPanes.length) ? chatPaneFocusIndex : 0,
        };
      }),

  }), {
    name: 'app-app-chat-panes',
  },
));

export function getInstantAppChatPanesCount() {
  return useAppChatPanesStore.getState().chatPanes.length;
}

export function usePanesManager() {
  // use Panes
  const { onConversationsChanged, ...panesFunctions } = useAppChatPanesStore(state => {
    const {
      chatPaneFocusIndex,
      chatPanes,
      navigateHistoryInFocusedPane,
      onConversationsChanged,
      openConversationInFocusedPane,
      openConversationInSplitPane,
      removePane,
      setFocusedPane,
    } = state;
    const focusedConversationId = chatPaneFocusIndex !== null ? chatPanes[chatPaneFocusIndex]?.conversationId ?? null : null;
    return {
      chatPanes: chatPanes as Readonly<ChatPane[]>,
      focusedConversationId,
      navigateHistoryInFocusedPane,
      onConversationsChanged,
      openConversationInFocusedPane,
      openConversationInSplitPane,
      focusedPaneIndex: chatPaneFocusIndex,
      removePane,
      setFocusedPane,
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
    ...panesFunctions,
  };
}

export function usePaneDuplicateOrClose() {
  return useAppChatPanesStore(state => ({
    canAddPane: state.chatPanes.length < 4,
    isMultiPane: state.chatPanes.length > 1,
    duplicateFocusedPane: state.duplicateFocusedPane,
    removeOtherPanes: state.removeOtherPanes,
  }), shallow);
}