import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import { DConversationId } from '~/common/stores/chat/chat.conversation';
import { agiUuid } from '~/common/util/idUtils';
import { useChatStore } from '~/common/stores/chat/store-chats';


// change this to increase/decrease the number history steps per pane
const MAX_HISTORY_LENGTH = 10;

// change this to allow for more/less panes
const MAX_CONCURRENT_PANES = 4;

// change to true to enable verbose console logging
const DEBUG_PANES_MANAGER = false;


// Future: support different types of panes: chat, docs, diff, settings, (beam?) etc.
// type Pane = ChatPane;

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

interface AppChatPanesActions {

  // actions
  openConversationInFocusedPane: (conversationId: DConversationId) => void;
  openConversationInSplitPane: (conversationId: DConversationId) => void;
  navigateHistoryInFocusedPane: (direction: 'back' | 'forward') => boolean;
  duplicateFocusedPane: (/*paneIndex: number*/) => void;
  insertEmptyAfterFocusedPane: (reuseEmpty: boolean) => void;
  removeNonFocusedPanes: () => void;
  removePane: (paneIndex: number) => void;
  removeOtherPanes: (keepPaneIndex: number) => void;
  setFocusedPaneIndex: (paneIndex: number) => void;
  _onConversationsChanged: (conversationIds: DConversationId[]) => void;

}


const useAppChatPanesStore = create<AppChatPanesState & AppChatPanesActions>()(persist(
  (_set, _get) => ({

    // Initial state: no panes
    chatPanes: [] as ChatPane[],
    chatPaneFocusIndex: null as number | null,

    openConversationInFocusedPane: (conversationId: DConversationId) => {
      _set((state) => {
        const { chatPanes, chatPaneFocusIndex } = state;

        // If there's no pane or no focused pane, create and focus a new one.
        if (!chatPanes.length || chatPaneFocusIndex === null) {
          const newPane = _createChatPane(conversationId);
          return {
            chatPanes: [newPane],
            chatPaneFocusIndex: 0, // Focus the new pane
          };
        }

        // sanity check: Get the focused pane
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
            focusedPane ? _duplicateChatPane(focusedPane) : _createChatPane(null),
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
          _duplicateChatPane(paneToDuplicate),
          ...chatPanes.slice(dstIndex),
        ];

        return {
          chatPanes: newPanes,
          chatPaneFocusIndex: dstIndex,
        };
      }),

    insertEmptyAfterFocusedPane: (reuseEmpty: boolean) =>
      _set(state => {
        const { chatPanes, chatPaneFocusIndex: _srcIndex } = state;

        // if reusing, move focus to the first empty pane, if any
        if (reuseEmpty) {
          const emptyPaneIndex = chatPanes.findIndex(pane => pane.conversationId === null);
          if (emptyPaneIndex >= 0) {
            if (DEBUG_PANES_MANAGER)
              console.log('insertEmptyAfterFocusedPane: reusing empty pane at:', emptyPaneIndex);
            return {
              chatPaneFocusIndex: emptyPaneIndex,
            };
          }
        }

        // check precondition
        if (chatPanes.length >= MAX_CONCURRENT_PANES) {
          console.warn('Cannot add more panes: maximum reached');
          return state;
        }

        // insert an empty pane after the focused pane, or at the end if no focus
        const dstIndex = (_srcIndex !== null && _srcIndex >= 0) ? _srcIndex + 1 : chatPanes.length;
        const newPanes = [
          ...chatPanes.slice(0, dstIndex),
          _createChatPane(null),
          ...chatPanes.slice(dstIndex),
        ];

        if (DEBUG_PANES_MANAGER)
          console.log('insertEmptyAfterFocusedPane: created new empty pane at:', dstIndex);

        return {
          chatPanes: newPanes,
          chatPaneFocusIndex: dstIndex, // focus the new empty pane
        };
      }),

    removeNonFocusedPanes: () =>
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

    removeOtherPanes: (keepPaneIdx: number) =>
      _set(state => {
        const { chatPanes } = state;
        if (keepPaneIdx < 0 || keepPaneIdx >= chatPanes.length || chatPanes.length <= 1 /* if only one pane, no need to do anything */)
          return state;

        const newPanes = [chatPanes[keepPaneIdx]];

        // focus the only remaining pane
        return {
          chatPanes: newPanes,
          chatPaneFocusIndex: 0,
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
          chatPanes: newPanes.length ? newPanes : [_createChatPane(conversationIds[0] ?? null)],
          chatPaneFocusIndex: (newPanes.length && chatPaneFocusIndex !== null && chatPaneFocusIndex < newPanes.length) ? chatPaneFocusIndex : 0,
        };
      }),

  }), {
    // note: added the '-2' suffix on 20240308 to invalidate the persisted state, as we are adding a paneId
    name: 'app-app-chat-panes-2',
  },
));


function _createChatPane(conversationId: DConversationId | null = null): ChatPane {
  return {
    paneId: agiUuid('chat-pane'),
    conversationId,
    history: conversationId ? [conversationId] : [],
    historyIndex: conversationId ? 0 : -1,
  };
}

function _duplicateChatPane(pane: ChatPane): ChatPane {
  return {
    paneId: agiUuid('chat-pane'),
    conversationId: pane.conversationId,
    history: [...pane.history],
    historyIndex: pane.historyIndex,
  };
}


// Instant getters

export function panesManagerActions(): AppChatPanesActions {
  return useAppChatPanesStore.getState();
}

export function getInstantAppChatPanesCount() {
  return useAppChatPanesStore.getState().chatPanes.length;
}


// Reactive hooks

export function usePanesManager() {
  // use Panes - Note: before we had { _onConversationsChanged, ...panesFunctions } = ... but we don't need the internal function anymore
  const panesData = useAppChatPanesStore(useShallow(state => ({
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
  })));

  // use changes in Conversation IDs[] to trigger the existence check
  const conversationIDs: DConversationId[] = useChatStore(useShallow(state =>
    state.conversations.map(_c => _c.id),
  ));

  // [Effect] Ensure all Panes have a valid Conversation ID
  React.useEffect(() => {
    panesManagerActions()._onConversationsChanged(conversationIDs);
  }, [conversationIDs]);

  return panesData;
}

export function usePaneDuplicateOrClose() {
  return useAppChatPanesStore(useShallow(state => ({
    // state
    canAddPane: state.chatPanes.length < MAX_CONCURRENT_PANES
      // if the current pane has an empty conversation, don't add another one!
      && (state.chatPaneFocusIndex === null || state.chatPanes[state.chatPaneFocusIndex].conversationId !== null),
    isMultiPane: state.chatPanes.length > 1,
    // actions
    duplicateFocusedPane: state.duplicateFocusedPane,
    removeOtherPanes: state.removeOtherPanes,
  })));
}