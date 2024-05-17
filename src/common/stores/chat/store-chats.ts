import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { v4 as uuidv4 } from 'uuid';

import { DLLMId, getChatLLMId } from '~/modules/llms/store-llms';
import { SystemPurposeId } from '../../../data';

import { backupIdbV3, idbStateStorage } from '~/common/util/idbUtils';
import { countModelTokens } from '~/common/util/token-counter';

import { conversationTitle, convertCConversation_V3_V4, createDConversation, DConversation, DConversationId, duplicateCConversation } from './chat.conversation';
import { DMessage, DMessageId, DMessageMetadata } from './chat.message';


/// Conversations Store

interface ChatState {
  conversations: DConversation[];
}

export interface ChatActions {

  // CRUD conversations
  prependNewConversation: (personaId: SystemPurposeId | undefined) => DConversationId;
  importConversation: (c: DConversation, preventClash: boolean) => DConversationId;
  branchConversation: (cId: DConversationId, mId: DMessageId | null) => DConversationId | null;
  deleteConversations: (cIds: DConversationId[], newConversationPersonaId?: SystemPurposeId) => DConversationId;

  // within a conversation
  setAbortController: (cId: DConversationId, abortController: AbortController | null) => void;
  abortTyping: (cId: DConversationId) => void;
  setMessages: (cId: DConversationId, messages: DMessage[]) => void;
  appendMessage: (cId: DConversationId, message: DMessage) => void;
  deleteMessage: (cId: DConversationId, mId: DMessageId) => void;
  editMessage: (cId: DConversationId, mId: DMessageId, update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>), touchUpdated: boolean) => void;
  updateMetadata: (cId: DConversationId, mId: DMessageId, metadataDelta: Partial<DMessageMetadata>, touchUpdated?: boolean) => void;
  setSystemPurposeId: (cId: DConversationId, personaId: SystemPurposeId) => void;
  setAutoTitle: (cId: DConversationId, autoTitle: string) => void;
  setUserTitle: (cId: DConversationId, userTitle: string) => void;

  // utility function
  _editConversation: (cId: DConversationId, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) => void;
}

type ConversationsStore = ChatState & ChatActions;

const defaultConversations: DConversation[] = [createDConversation()];

export const useChatStore = create<ConversationsStore>()(devtools(
  persist(
    (_set, _get) => ({

      // default state
      conversations: defaultConversations,

      prependNewConversation: (personaId: SystemPurposeId | undefined): DConversationId => {
        const newConversation = createDConversation(personaId);

        _set(state => ({
          conversations: [newConversation, ...state.conversations],
        }));

        return newConversation.id;
      },

      importConversation: (conversation: DConversation, preventClash: boolean): DConversationId => {
        const { conversations } = _get();

        // if there's a clash, abort the former conversation, and optionally change the ID
        const existing = conversations.find(_c => _c.id === conversation.id);
        if (existing) {
          existing?.abortController?.abort();
          if (preventClash) {
            conversation.id = uuidv4();
            console.warn('Conversation ID clash, changing ID to', conversation.id);
          }
        }

        conversation.tokenCount = updateMessagesTokenCounts(conversation.messages, true, 'importConversation');

        _set({
          conversations: [conversation, ...conversations.filter(_c => _c.id !== conversation.id)],
        });

        return conversation.id;
      },

      branchConversation: (conversationId: DConversationId, messageId: DMessageId | null): DConversationId | null => {
        const { conversations } = _get();
        const conversation = conversations.find(_c => _c.id === conversationId);
        if (!conversation)
          return null;

        const branched = duplicateCConversation(conversation, messageId ?? undefined);

        _set({
          conversations: [branched, ...conversations],
        });

        return branched.id;
      },

      deleteConversations: (conversationIds: DConversationId[], newConversationPersonaId?: SystemPurposeId): DConversationId => {
        const { conversations } = _get();

        // find the index of first conversation to delete
        const cIndex = conversationIds.length > 0 ? conversations.findIndex(_c => _c.id === conversationIds[0]) : -1;

        // abort all pending requests
        conversationIds.forEach(conversationId => conversations.find(_c => _c.id === conversationId)?.abortController?.abort());

        // remove from the list
        const newConversations = conversations.filter(_c => !conversationIds.includes(_c.id));

        // create a new conversation if there are no more
        if (!newConversations.length)
          newConversations.push(createDConversation(newConversationPersonaId));

        _set({
          conversations: newConversations,
        });

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

      setAbortController: (conversationId: DConversationId, abortController: AbortController | null) =>
        _get()._editConversation(conversationId, () =>
          ({
            abortController: abortController,
          })),

      abortTyping: (conversationId: DConversationId) =>
        _get()._editConversation(conversationId, conversation => {
          conversation.abortController?.abort();
          return {
            abortController: null,
          };
        }),

      setMessages: (conversationId: DConversationId, newMessages: DMessage[]) =>
        _get()._editConversation(conversationId, conversation => {
          conversation.abortController?.abort();
          return {
            messages: newMessages,
            ...(!!newMessages.length ? {} : {
              autoTitle: undefined,
            }),
            tokenCount: updateMessagesTokenCounts(newMessages, false, 'setMessages'),
            updated: Date.now(),
            abortController: null,
          };
        }),

      appendMessage: (conversationId: DConversationId, message: DMessage) =>
        _get()._editConversation(conversationId, conversation => {

          if (!message.typing)
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

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: Date.now(),
          };
        }),

      editMessage: (conversationId: DConversationId, messageId: DMessageId, update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>), touchUpdated: boolean) =>
        _get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.map((message): DMessage => {
            if (message.id !== messageId)
              return message;

            const updatedMessage: DMessage = {
              ...message,
              ...(typeof update === 'function' ? update(message) : update),
              ...(touchUpdated && { updated: Date.now() }),
            };

            if (!updatedMessage.typing)
              updateMessageTokenCount(updatedMessage, getChatLLMId(), true, 'editMessage(typing=false)');

            return updatedMessage;
          });

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: touchUpdated ? Date.now() : conversation.updated,
          };
        }),

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
      storage: createJSONStorage(() => idbStateStorage),

      // Migrations
      migrate: async (state: any, fromVersion: number) => {

        // 3 -> 4: Convert messages to multi-part
        if (fromVersion < 4 && state && state.conversations && state.conversations.length) {
          if (await backupIdbV3('app-chats', 'app-chats-v3'))
            console.warn('Migrated app-chats from v3 to v4');
          state.conversations.forEach(convertCConversation_V3_V4);
        }

        return state;
      },

      // Pre-Saving: remove transient properties
      partialize: (state) => ({
        ...state,
        conversations: state.conversations.map((conversation: DConversation) => {
          const { abortController, ...rest } = conversation;
          return rest;
        }),
      }),

      // Post-Loading: re-add transient properties and cleanup state
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // fixup conversations
        for (const conversation of (state.conversations || [])) {
          // re-add transient properties
          conversation.abortController = null;
          // fixup messages
          for (const message of conversation.messages)
            message.typing = false;
        }
      },

    }),
  {
    name: 'AppChats',
    enabled: false,
  }),
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
    if (!llmId) {
      message.tokenCount = 0;
      return 0;
    }

    // NOTE: temporary flattening of text-only parts, until we figure out a better way to handle this
    // FIXME: this is a quick and dirty hack, until we move token counting outside
    const messageTextParts = message.content.reduce((fullText, part) => fullText + (part.type === 'text' ? part.text : ''), '');
    // TODO: handle attachments too
    message.tokenCount = countModelTokens(messageTextParts, llmId, debugFrom) ?? 0;
  }
  return message.tokenCount;
}


export const getConversation = (conversationId: DConversationId | null): DConversation | null =>
  conversationId ? useChatStore.getState().conversations.find(_c => _c.id === conversationId) ?? null : null;

export const getConversationSystemPurposeId = (conversationId: DConversationId | null): SystemPurposeId | null =>
  getConversation(conversationId)?.systemPurposeId || null;


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
