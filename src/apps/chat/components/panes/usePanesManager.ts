import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { v4 as uuidv4 } from 'uuid';

import { DConversationId, useChatStore } from '~/common/state/store-chats';


// change this to increase/decrease the number history steps per pane
const MAX_HISTORY_LENGTH = 10;

// change this to allow for more/less panes
const MAX_CONCURRENT_PANES = 4;

// change to true to enable verbose console logging
const DEBUG_PANES_MANAGER = false;


interface ChatPane {

  paneId: string;

  conversationId: DConversationId | null;

  // other per-pane storage? or would this be cluttering the panes(view)-only abstaction?
  // ... we are currently creating companion ConversationHandler obects for this

  history: DConversationId[]; // History of the conversationIds for this pane
  historyIndex: number; // Current position in the history for this pane

}

interface AppChatPanesState {

  chatPanes: ChatPane[];
  chatPaneFocusIndex: number | null;

}

interface AppChatPanesStore extends AppChatPanesState {

  // actions
  openConversationInFocusedPane: (conversationId: DConversationId) => void;
  openConversationInSplitPane: (conversationId: DConversationId) => void;
  navigateHistoryInFocusedPane: (direction: 'back' | 'forward') => boolean;
  duplicateFocusedPane: (/*paneIndex: number*/) => void;
  removeOtherPanes: () => void;
  removePane: (paneIndex: number) => void;
  setFocusedPaneIndex: (paneIndex: number) => void;
  _onConversationsChanged: (conversationIds: DConversationId[]) => void;

}

function createPane(conversationId: DConversationId | null = null): ChatPane {
  return {
    paneId: uuidv4(),
    conversationId,
    history: conversationId ? [conversationId] : [],
    historyIndex: conversationId ? 0 : -1,
  };
}

function duplicatePane(pane: ChatPane): ChatPane {
  return {
    paneId: uuidv4(),
    conversationId: pane.conversationId,
    history: [...pane.history],
    historyIndex: pane.historyIndex,
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

        // Sanity check: Get the focused pane
        const focusedPane = chatPanes[chatPaneFocusIndex];
        if (!focusedPane) {
          console.warn('openConversationInFocusedPane: focusedPane is null', chatPaneFocusIndex, chatPanes);
          return state;
        }

        // Check if the conversation is already open in the focused pane.
        if (focusedPane.conversationId === conversationId) {
          if (DEBUG_PANES_MANAGER)
            console.log(`open-focuses: ${conversationId} is open in focused pane`, chatPaneFocusIndex, chatPanes);
          return state;
        }

        // Truncate the future history before adding the new conversation.
        const truncatedHistory = focusedPane.history.slice(0, focusedPane.historyIndex + 1);
        const newHistory = [...truncatedHistory, conversationId].slice(-MAX_HISTORY_LENGTH);

        // Update the focused pane with the new conversation and history.
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

      // Copy from the focused pane, if there's one
      const focusedPane = chatPaneFocusIndex !== null ? chatPanes[chatPaneFocusIndex] ?? null : null;

      // if fewer than the maximum panes, create a new pane and focus it
      if (chatPanes.length < MAX_CONCURRENT_PANES) {
        const insertIndex = chatPaneFocusIndex !== null ? chatPaneFocusIndex + 1 : chatPanes.length;
        _set((state) => ({
          chatPanes: [
            ...state.chatPanes.slice(0, insertIndex),
            focusedPane ? duplicatePane(focusedPane) : createPane(null),
            ...state.chatPanes.slice(insertIndex),
          ],
          chatPaneFocusIndex: insertIndex,
        }));
      }
      // max reached, replace the next pane (with wraparound) - note the outside logic won't get us here
      else {
        const replaceIndex = (chatPaneFocusIndex !== null ? chatPaneFocusIndex + 1 : 0) % MAX_CONCURRENT_PANES;
        _set({
          chatPaneFocusIndex: replaceIndex,
        });
      }

      // Open the conversation in the newly created or updated pane
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
        const dstIndex = _srcIndex + 1;

        // Insert the duplicated pane into the array, right after the original pane
        const newPanes = [
          ...chatPanes.slice(0, dstIndex),
          duplicatePane(paneToDuplicate),
          ...chatPanes.slice(dstIndex),
        ];

        return {
          chatPanes: newPanes,
          chatPaneFocusIndex: dstIndex,
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

    setFocusedPaneIndex: (paneIndex: number) =>
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
    _onConversationsChanged: (conversationIds: DConversationId[]) =>
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
    // note: added the '-2' suffix on 20240308 to invalidate the persisted state, as we are adding a paneId
    name: 'app-app-chat-panes-2',
  },
));

export function getInstantAppChatPanesCount() {
  return useAppChatPanesStore.getState().chatPanes.length;
}

export function usePanesManager() {
  // use Panes
  const { _onConversationsChanged, ...panesFunctions } = useAppChatPanesStore(useShallow(state => ({
    // state
    chatPanes: state.chatPanes as Readonly<ChatPane[]>,
    focusedPaneIndex: state.chatPaneFocusIndex,
    focusedPaneConversationId: state.chatPaneFocusIndex !== null ? state.chatPanes[state.chatPaneFocusIndex]?.conversationId ?? null : null,
    // methods
    openConversationInFocusedPane: state.openConversationInFocusedPane,
    openConversationInSplitPane: state.openConversationInSplitPane,
    navigateHistoryInFocusedPane: state.navigateHistoryInFocusedPane,
    removePane: state.removePane,
    setFocusedPaneIndex: state.setFocusedPaneIndex,
    _onConversationsChanged: state._onConversationsChanged,
  })));

  // use Conversation IDs[]
  const conversationIDs: DConversationId[] = useChatStore(useShallow(state =>
    state.conversations.map(_c => _c.id),
  ));

  // [Effect] Ensure all Panes have a valid Conversation ID
  React.useEffect(() => {
    _onConversationsChanged(conversationIDs);
  }, [conversationIDs, _onConversationsChanged]);

  return {
    ...panesFunctions,
  };
}

export function usePaneDuplicateOrClose() {
  return useAppChatPanesStore(useShallow(state => ({
    // state
    canAddPane: state.chatPanes.length < MAX_CONCURRENT_PANES,
    isMultiPane: state.chatPanes.length > 1,
    // actions
    duplicateFocusedPane: state.duplicateFocusedPane,
    removeOtherPanes: state.removeOtherPanes,
  })));
}