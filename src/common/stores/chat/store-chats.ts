import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import type { SystemPurposeId } from '../../../data';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { findLLMOrThrow, getChatLLMId } from '~/common/stores/llms/store-llms';

import { agiUuid } from '~/common/util/idUtils';
import { backupIdbV3, createIDBPersistStorage } from '~/common/util/idbUtils';

import { workspaceActions } from '~/common/stores/workspace/store-client-workspace';
import { workspaceForConversationIdentity } from '~/common/stores/workspace/workspace.types';

import { DMessage, DMessageId, DMessageMetadata, MESSAGE_FLAG_AIX_SKIP, messageHasUserFlag } from './chat.message';
import type { DMessageFragment, DMessageFragmentId } from './chat.fragments';
import { V3StoreDataToHead, V4ToHeadConverters } from './chats.converters';
import { conversationTitle, createDConversation, DConversation, DConversationId, duplicateDConversationNoVoid } from './chat.conversation';
import { estimateTokensForFragments } from './chat.tokens';
import { gcChatImageAssets } from '~/common/stores/chat/chat.gc';


/// Conversations Store

interface ChatState {
  conversations: DConversation[];
}

export interface ChatActions {

  // CRUD conversations
  prependNewConversation: (personaId: SystemPurposeId | undefined, isIncognito: boolean) => DConversationId;
  importConversation: (c: DConversation, preventClash: boolean) => DConversationId;
  branchConversation: (cId: DConversationId, mId: DMessageId | null) => DConversationId | null;
  deleteConversations: (cIds: DConversationId[], newConversationPersonaId?: SystemPurposeId) => DConversationId;

  // within a conversation
  isIncognito: (cId: DConversationId) => boolean | undefined;
  setAbortController: (cId: DConversationId, _abortController: AbortController | null, debugScope: string) => void;
  abortConversationTemp: (cId: DConversationId) => void;
  historyReplace: (cId: DConversationId, messages: DMessage[]) => void;
  historyTruncateToIncluded: (cId: DConversationId, mId: DMessageId, offset: number) => void;
  historyView: (cId: DConversationId) => Readonly<DMessage[]> | undefined;
  appendMessage: (cId: DConversationId, message: DMessage) => void;
  deleteMessage: (cId: DConversationId, mId: DMessageId) => void;
  editMessage: (cId: DConversationId, mId: DMessageId, update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>), removePendingState: boolean, touchUpdated: boolean) => void;
  appendMessageFragment: (cId: DConversationId, mId: DMessageId, fragment: DMessageFragment, removePendingState: boolean, touchUpdated: boolean) => void;
  deleteMessageFragment: (cId: DConversationId, mId: DMessageId, fId: DMessageFragmentId, removePendingState: boolean, touchUpdated: boolean) => void;
  replaceMessageFragment: (cId: DConversationId, mId: DMessageId, fId: DMessageFragmentId, newFragment: DMessageFragment, removePendingState: boolean, touchUpdated: boolean) => void;
  updateMetadata: (cId: DConversationId, mId: DMessageId, metadataDelta: Partial<DMessageMetadata>, touchUpdated?: boolean) => void;
  setSystemPurposeId: (cId: DConversationId, personaId: SystemPurposeId) => void;
  setAutoTitle: (cId: DConversationId, autoTitle: string) => void;
  setUserTitle: (cId: DConversationId, userTitle: string) => void;
  setUserSymbol: (cId: DConversationId, userSymbol: string | null) => void;
  title: (cId: DConversationId) => string | undefined;

  // utility function
  _editConversation: (cId: DConversationId, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) => void;
}

type ConversationsStore = ChatState & ChatActions;

const defaultConversations: DConversation[] = [createDConversation()];

export const useChatStore = create<ConversationsStore>()(/*devtools(*/
  persist(
    (_set, _get) => ({

      // default state
      conversations: defaultConversations,

      prependNewConversation: (personaId: SystemPurposeId | undefined, isIncognito: boolean): DConversationId => {
        const newConversation = createDConversation(personaId);
        if (isIncognito) newConversation._isIncognito = true;

        _set(state => ({
          conversations: [newConversation, ...state.conversations],
        }));

        // [workspace] import messages' LiveFiles
        workspaceActions().importAssignmentsFromMessages(workspaceForConversationIdentity(newConversation.id), newConversation.messages);

        return newConversation.id;
      },

      /** Used by:
       * - openAndLoadConversations (via DataAtRestV1.recreateConversation),
       * - LinkChatViewer(from RestV1),
       * - ImportChats.handleChatGptLoad(H)
       */
      importConversation: (conversation: DConversation, preventClash: boolean): DConversationId => {
        const { conversations } = _get();

        // if there's a clash, abort the former conversation, and optionally change the ID
        const existing = conversations.find(_c => _c.id === conversation.id);
        if (existing) {
          existing?._abortController?.abort();
          if (preventClash) {
            conversation.id = agiUuid('chat-dconversation');
            console.warn('Conversation ID clash, changing ID to', conversation.id);
          }
        }

        // every path that leads here should have an equivalent function ran, however, for extra
        // caution, we sanitize and re-run this here, to upgrade the message to the current version
        V4ToHeadConverters.inMemHeadCleanDConversations([conversation]);

        conversation.tokenCount = updateMessagesTokenCounts(conversation.messages, true, 'importConversation');

        _set({
          conversations: [conversation, ...conversations.filter(_c => _c.id !== conversation.id)],
        });

        // [workspace] import messages' LiveFiles
        workspaceActions().importAssignmentsFromMessages(workspaceForConversationIdentity(conversation.id), conversation.messages);

        return conversation.id;
      },

      branchConversation: (conversationId: DConversationId, messageId: DMessageId | null): DConversationId | null => {
        const { conversations } = _get();
        const conversation = conversations.find(_c => _c.id === conversationId);
        if (!conversation)
          return null;

        const branched = duplicateDConversationNoVoid(conversation, messageId ?? undefined);

        _set({
          conversations: [branched, ...conversations],
        });

        // [workspace] assign all files of workspace1 to workspace2 (HACK until we have workspaces != conversations)
        workspaceActions().copyAssignments(workspaceForConversationIdentity(conversation.id), workspaceForConversationIdentity(branched.id));

        return branched.id;
      },

      deleteConversations: (conversationIds: DConversationId[], newConversationPersonaId?: SystemPurposeId): DConversationId => {
        const { conversations } = _get();

        // find the index of first conversation to delete
        const cIndex = conversationIds.length > 0 ? conversations.findIndex(_c => _c.id === conversationIds[0]) : -1;

        // abort all pending requests
        conversationIds.forEach(conversationId => conversations.find(_c => _c.id === conversationId)?._abortController?.abort());

        // remove from the list
        const newConversations = conversations.filter(_c => !conversationIds.includes(_c.id));

        // create a new conversation if there are no more
        if (!newConversations.length)
          newConversations.push(createDConversation(newConversationPersonaId));

        _set({
          conversations: newConversations,
        });

        // [workspace] since conversation=workspace for now, remove all workspaces too
        conversationIds.forEach(conversationId => workspaceActions().remove(workspaceForConversationIdentity(conversationId)));

        // return the next conversation Id in line, if valid
        return newConversations[(cIndex >= 0 && cIndex < newConversations.length) ? cIndex : 0].id;
      },


      // within a conversation

      _editConversation: (conversationId: DConversationId, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) =>
        _set(state => ({
          conversations: state.conversations.map((conversation): DConversation =>
            conversation.id === conversationId
              ? {
                ...conversation,
                ...(typeof update === 'function' ? update(conversation) : update),
              }
              : conversation,
          ),
        })),

      isIncognito: (conversationId: DConversationId): boolean | undefined =>
        _get().conversations.find(_c => _c.id === conversationId)?._isIncognito ?? undefined,

      setAbortController: (conversationId: DConversationId, _nextController: AbortController | null, debugScope: string) =>
        _get()._editConversation(conversationId, ({ _abortController: _currentController }) => {
          // [DEV] Debug state management of controllers - FIXME: migrate away from a per-chat, unless done properly (cascade triggering)
          if (_nextController !== null && _currentController) {
            const isAlreadyAborted = _currentController.signal.aborted;
            if (process.env.NODE_ENV === 'development')
              console.warn(`[DEV] setAbortController (${debugScope}): race condition (${isAlreadyAborted ? 'Already aborted' : 'Not aborted'}) for conversation ${conversationId}`);
            if (!isAlreadyAborted)
              _currentController.abort();
          }
          return {
            _abortController: _nextController,
          };
        }),

      abortConversationTemp: (conversationId: DConversationId) =>
        _get()._editConversation(conversationId, conversation => {
          conversation._abortController?.abort();
          return {
            _abortController: null,
          };
        }),


      historyReplace: (conversationId: DConversationId, newMessages: DMessage[]) =>
        _get()._editConversation(conversationId, conversation => {
          conversation._abortController?.abort();

          // [workspace]
          // Note: not doing it for now, as all the callers' flows do not contain different LiveFiles,
          // however, in general, we should act on the messages being replaced!

          return {
            messages: newMessages,
            ...(!!newMessages.length ? {} : {
              autoTitle: undefined,
            }),
            tokenCount: updateMessagesTokenCounts(newMessages, false, 'historyReplace'),
            updated: Date.now(),
            _abortController: null,
          };
        }),

      historyTruncateToIncluded: (conversationId: DConversationId, messageId: DMessageId, offset: number) =>
        _get()._editConversation(conversationId, conversation => {
          const messageIndex = conversation.messages.findIndex(m => m.id === messageId);
          if (messageIndex < 0 || messageIndex + 1 + offset >= conversation.messages.length)
            return {};

          conversation._abortController?.abort();

          const truncatedMessages = conversation.messages.slice(0, Math.max(0, messageIndex + 1 + offset));

          // [workspace]
          // Note: simple chat truncation does not side-effect workspaces

          return {
            messages: truncatedMessages,
            tokenCount: updateMessagesTokenCounts(truncatedMessages, false, 'historyTruncateToIncluded'),
            updated: Date.now(),
            _abortController: null,
          };
        }),

      historyView: (conversationId: DConversationId): Readonly<DMessage[]> | undefined =>
        _get().conversations.find(_c => _c.id === conversationId)?.messages ?? undefined,


      appendMessage: (conversationId: DConversationId, message: DMessage) =>
        _get()._editConversation(conversationId, conversation => {

          // [workspace] import message's resources into the workspace
          workspaceActions().importAssignmentsFromMessages(workspaceForConversationIdentity(conversationId), [message]);

          if (!message.pendingIncomplete)
            updateMessagesTokenCounts([message], true, 'appendMessage');

          const messages = [...conversation.messages, message];

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: Date.now(),
          };
        }),

      deleteMessage: (conversationId: DConversationId, messageId: DMessageId) =>
        _get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.filter(message => message.id !== messageId);

          // [workspace]
          // Note: simple deletion of a message does not side-effect workspaces

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: Date.now(),
          };
        }),

      editMessage: (conversationId: DConversationId, messageId: DMessageId, update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>), removePendingState: boolean, touchUpdated: boolean) =>
        _get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.map((message): DMessage => {
            if (message.id !== messageId)
              return message;

            const updatedMessage: DMessage = {
              ...message,
              ...(typeof update === 'function' ? update(message) : update),
              ...(touchUpdated && { updated: Date.now() }),
            };

            if (removePendingState)
              delete updatedMessage.pendingIncomplete;

            if (!updatedMessage.pendingIncomplete)
              updateMessageTokenCount(updatedMessage, getChatLLMId(), true, 'editMessage(incomplete=false)');

            return updatedMessage;
          });

          // [workspaces]
          // NOTE: we assume that no workspace side-effect-producing change is performed

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: touchUpdated ? Date.now() : conversation.updated,
          };
        }),


      appendMessageFragment: (conversationId: DConversationId, messageId: DMessageId, fragment: DMessageFragment, removePendingState: boolean, touchUpdated: boolean) => {
        _get().editMessage(conversationId, messageId, message => ({
          fragments: [...message.fragments, fragment],
        }), removePendingState, touchUpdated);

        // [workspace]
        // Note: in the future when we have side-effect appends (e.g. new Attachment/Docs/Etc) we may
        // need implementation of the fragment methods here
      },

      deleteMessageFragment: (conversationId: DConversationId, messageId: DMessageId, fragmentId: DMessageFragmentId, removePendingState: boolean, touchUpdated: boolean) =>
        _get().editMessage(conversationId, messageId, message => ({
          fragments: message.fragments.filter(f => f.fId !== fragmentId),
        }), removePendingState, touchUpdated),

      replaceMessageFragment: (conversationId: DConversationId, messageId: DMessageId, fragmentId: DMessageFragmentId, newFragment: DMessageFragment, removePendingState: boolean, touchUpdated: boolean) =>
        _get().editMessage(conversationId, messageId, message => {

          // Warn if the fragment is not found
          const fragmentIndex = message.fragments.findIndex(f => f.fId === fragmentId);
          if (fragmentIndex < 0) {
            console.error(`replaceFragment: fragment not found for ID ${fragmentId}`);
            return {};
          }

          // Replace the fragment
          return {
            fragments: message.fragments.map((fragment, index) =>
              (index === fragmentIndex)
                ? { ...newFragment } // force the object tree to change, just in case the contents changed but not the object reference
                : fragment,
            ),
          };
        }, removePendingState, touchUpdated),

      updateMetadata: (conversationId: DConversationId, messageId: DMessageId, metadataDelta: Partial<DMessageMetadata>, touchUpdated: boolean = true) => {
        _get()._editConversation(conversationId, conversation => {
          const messages = conversation.messages.map(message =>
            message.id !== messageId ? message
              : {
                ...message,
                metadata: {
                  ...message.metadata,
                  ...metadataDelta,
                },
                updated: touchUpdated ? Date.now() : message.updated,
              },
          );

          return {
            messages,
            updated: touchUpdated ? Date.now() : conversation.updated,
          };
        });
      },

      setSystemPurposeId: (conversationId: DConversationId, personaId: SystemPurposeId) =>
        _get()._editConversation(conversationId,
          {
            systemPurposeId: personaId,
          }),

      setAutoTitle: (conversationId: DConversationId, autoTitle: string) =>
        _get()._editConversation(conversationId,
          {
            autoTitle,
          }),

      setUserTitle: (conversationId: DConversationId, userTitle: string) =>
        _get()._editConversation(conversationId,
          {
            userTitle,
            ...(!userTitle && { autoTitle: undefined }), // clear autotitle when clearing usertitle
          }),

      title: (conversationId: DConversationId): string | undefined => {
        const existing = _get().conversations.find(_c => _c.id === conversationId);
        return existing ? conversationTitle(existing) : undefined;
      },

      setUserSymbol: (conversationId: DConversationId, userSymbol: string | null) =>
        _get()._editConversation(conversationId,
          {
            userSymbol: userSymbol || undefined,
          }),

    }),
    {
      name: 'app-chats',
      /* Version history:
       *  - 1: [2023-03-18] App launch, single chat
       *  - 2: [2023-04-10] Multi-chat version - invalidating data to be sure
       *  - 3: [2023-09-19] Switch to IndexedDB - no data shape change,
       *                    but we swapped the backend (localStorage -> IndexedDB)
       *  - 4: [2024-05-14] Convert messages to multi-part, removed the IDB migration
       */
      version: 4,
      storage: createIDBPersistStorage<ConversationsStore>(),

      // Migrations
      migrate: async (state: any, fromVersion: number) => {

        // 3 -> 4: Convert messages to multi-part
        if (fromVersion < 4 && state && state.conversations && state.conversations.length) {

          if (await backupIdbV3('app-chats', 'app-chats-v3'))
            console.warn('Migrated app-chats from v3 to v4');

          state.conversations = V3StoreDataToHead.recreateConversations(state.conversations);
        }

        return state;
      },

      // Pre-Saving: remove transient properties
      partialize: (state) => ({
        ...state,
        conversations: state.conversations
          .filter((c, _ignoreIdx, all) => {
            // do not save incognito conversations
            if (c._isIncognito) return false;
            // do not save empty conversations, begin saving them when they have content
            return c.messages?.length || c.userTitle || c.autoTitle || all.length <= 1;
          })
          .map((conversation: DConversation) => {
            // remove the converation AbortController (current data structure version)
            const { _abortController, ...rest } = conversation;
            return rest;
          }),
      }),

      // Post-Loading: re-add transient properties and cleanup state
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // fixup conversations in-memory
        V4ToHeadConverters.inMemHeadCleanDConversations(state.conversations || []);

        // [GC] Chat Image Assets
        // NOTE: this used to be in 'sherpa', but that caused the storage to be read too early, so we do it here post hydration
        //       and synchronously, as it's a rather quick operation (most of the times there won't be any effect).
        void gcChatImageAssets(state.conversations);

      },

    }),
  /*{ name: 'AppChats', enabled: false }), */
);


// Convenience function to update a set of messages, using the current chatLLM
function updateMessagesTokenCounts(messages: DMessage[], forceUpdate: boolean, debugFrom: string): number {
  const chatLLMId = getChatLLMId();
  return 3 + messages.reduce((sum, message) => {
    return 4 + updateMessageTokenCount(message, chatLLMId, forceUpdate, debugFrom) + sum;
  }, 0);
}

// Convenience function to count the tokens in a DMessage object
function updateMessageTokenCount(message: DMessage, llmId: DLLMId | null, forceUpdate: boolean, debugFrom: string): number {
  if (forceUpdate || !message.tokenCount) {
    // if flagged as skip, do not include this message in the count
    if (messageHasUserFlag(message, MESSAGE_FLAG_AIX_SKIP)) {
      message.tokenCount = 0;
      return 0;
    }

    // if there's no LLM, we can't count tokens
    if (!llmId) {
      message.tokenCount = 0;
      return 0;
    }

    // find the LLM from the ID
    try {
      const dllm = findLLMOrThrow(llmId);
      message.tokenCount = estimateTokensForFragments(dllm, message.role, message.fragments, false, debugFrom);
    } catch (e) {
      console.error(`updateMessageTokenCount: LLM not found for ID ${llmId}`);
      message.tokenCount = 0;
    }
  }
  return message.tokenCount;
}


export function isValidConversation(conversationId?: DConversationId | null): conversationId is DConversationId {
  return !!conversationId && getConversation(conversationId) !== null;
}

export function getConversation(conversationId: DConversationId | null): DConversation | null {
  return conversationId ? useChatStore.getState().conversations.find(_c => _c.id === conversationId) ?? null : null;
}

export function getConversationSystemPurposeId(conversationId: DConversationId | null): SystemPurposeId | null {
  return getConversation(conversationId)?.systemPurposeId || null;
}


export const useConversation = (conversationId: DConversationId | null) => useChatStore(useShallow(state => {
  const { conversations } = state;

  // this object will change if any sub-prop changes as well
  const conversation = conversationId ? conversations.find(_c => _c.id === conversationId) ?? null : null;
  const title = conversation ? conversationTitle(conversation) : null;
  const isEmpty = conversation ? !conversation.messages.length : true;
  const isDeveloper = conversation?.systemPurposeId === 'Developer';
  const conversationIdx = conversation ? conversations.findIndex(_c => _c.id === conversation.id) : -1;

  const hasConversations = conversations.length > 1 || (conversations.length === 1 && !!conversations[0].messages.length);
  const recycleNewConversationId = (conversations.length && !conversations[0].messages.length) ? conversations[0].id : null;

  return {
    title,
    isEmpty,
    isDeveloper,
    conversationIdx,
    hasConversations,
    recycleNewConversationId,
    prependNewConversation: state.prependNewConversation,
    branchConversation: state.branchConversation,
    deleteConversations: state.deleteConversations,
  };
}));
