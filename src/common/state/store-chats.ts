import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { v4 as uuidv4 } from 'uuid';

import { DLLMId, getChatLLMId } from '~/modules/llms/store-llms';

import { idbStateStorage } from '../util/idbUtils';
import { countModelTokens } from '../util/token-counter';
import { defaultSystemPurposeId, SystemPurposeId } from '../../data';


export type DConversationId = string;

/**
 * Conversation, a list of messages between humans and bots
 * Future:
 * - draftUserMessage?: { text: string; attachments: any[] };
 * - isMuted: boolean; isArchived: boolean; Starred: boolean; participants: string[];
 */
export interface DConversation {
  id: DConversationId;
  messages: DMessage[];
  systemPurposeId: SystemPurposeId;
  userTitle?: string;
  autoTitle?: string;
  tokenCount: number;                 // f(messages, llmId)
  created: number;                    // created timestamp (Date.now())
  updated: number | null;             // updated timestamp (Date.now())
  // Not persisted, used while in-memory, or temporarily by the UI
  abortController: AbortController | null;
}

export function createDConversation(systemPurposeId?: SystemPurposeId): DConversation {
  return {
    id: uuidv4(),
    messages: [],
    systemPurposeId: systemPurposeId || defaultSystemPurposeId,
    tokenCount: 0,
    created: Date.now(),
    updated: Date.now(),
    abortController: null,
  };
}

const defaultConversations: DConversation[] = [createDConversation()];

/**
 * Message, sent or received, by humans or bots
 *
 * Other ideas:
 * - attachments?: {type: string; url: string; thumbnailUrl?: string; size?: number}[];
 * - isPinned?: boolean;
 * - reactions?: {type: string; count: number; users: string[]}[];
 * - status: 'sent' | 'delivered' | 'read' | 'failed';
 */
export interface DMessage {
  id: string;
  text: string;
  sender: 'You' | 'Bot' | string;   // pretty name
  avatar: string | null;            // null, or image url
  typing: boolean;
  role: 'assistant' | 'system' | 'user';

  purposeId?: SystemPurposeId;      // only assistant/system
  originLLM?: string;               // only assistant - model that generated this message, goes beyond known models

  metadata?: DMessageMetadata;      // metadata, mainly at creation and for UI
  userFlags?: DMessageUserFlag[];   // (UI) user-set per-message flags

  tokenCount: number;               // cache for token count, using the current Conversation model (0 = not yet calculated)

  created: number;                  // created timestamp
  updated: number | null;           // updated timestamp
}

export type DMessageUserFlag =
  | 'starred'; // user starred this

export interface DMessageMetadata {
  inReplyToText?: string;           // text this was in reply to
}

export function createDMessage(role: DMessage['role'], text: string): DMessage {
  return {
    id: uuidv4(),
    text,
    sender: role === 'user' ? 'You' : 'Bot',
    avatar: null,
    typing: false,
    role: role,
    tokenCount: 0,
    created: Date.now(),
    updated: null,
  };
}

export function messageHasUserFlag(message: DMessage, flag: DMessageUserFlag): boolean {
  return message.userFlags?.includes(flag) ?? false;
}

export function messageToggleUserFlag(message: DMessage, flag: DMessageUserFlag): DMessageUserFlag[] {
  if (message.userFlags?.includes(flag))
    return message.userFlags.filter(_f => _f !== flag);
  else
    return [...(message.userFlags || []), flag];
}

const dMessageUserFlagToEmojiMap: Record<DMessageUserFlag, string> = {
  starred: '⭐️',
};

export function messageUserFlagToEmoji(flag: DMessageUserFlag): string {
  return dMessageUserFlagToEmojiMap[flag] || '❓';
}


/// Conversations Store

interface ChatState {
  conversations: DConversation[];
}

export interface ChatActions {
  // store setters
  prependNewConversation: (personaId: SystemPurposeId | undefined) => DConversationId;
  importConversation: (conversation: DConversation, preventClash: boolean) => DConversationId;
  branchConversation: (conversationId: DConversationId, messageId: string | null) => DConversationId | null;
  deleteConversations: (conversationIds: DConversationId[], newConversationPersonaId?: SystemPurposeId) => DConversationId;

  // within a conversation
  setAbortController: (conversationId: string, abortController: AbortController | null) => void;
  stopTyping: (conversationId: string) => void;
  setMessages: (conversationId: string, messages: DMessage[]) => void;
  appendMessage: (conversationId: string, message: DMessage) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  editMessage: (conversationId: string, messageId: string, update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>), touchUpdated: boolean) => void;
  updateMetadata: (conversationId: string, messageId: string, metadataDelta: Partial<DMessageMetadata>, touchUpdated?: boolean) => void;
  setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => void;
  setAutoTitle: (conversationId: string, autoTitle: string) => void;
  setUserTitle: (conversationId: string, userTitle: string) => void;

  // utility function
  _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) => void;
}

type ConversationsStore = ChatState & ChatActions;

export const useChatStore = create<ConversationsStore>()(devtools(
  persist(
    (_set, _get) => ({

      // default state
      conversations: defaultConversations,

      prependNewConversation: (personaId: SystemPurposeId | undefined): DConversationId => {
        const newConversation = createDConversation(personaId);

        _set(state => ({
          conversations: [
            newConversation,
            ...state.conversations,
          ],
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

        conversation.tokenCount = updateTokenCounts(conversation.messages, true, 'importConversation');

        _set({
          conversations: [
            conversation,
            ...conversations.filter(_c => _c.id !== conversation.id),
          ],
        });

        return conversation.id;
      },

      branchConversation: (conversationId: DConversationId, messageId: string | null): DConversationId | null => {
        const { conversations } = _get();
        const conversation = conversations.find(_c => _c.id === conversationId);
        if (!conversation)
          return null;

        // create a deep copy of the conversation
        const deepCopy: DConversation = JSON.parse(JSON.stringify(conversation));
        let messageIndex = deepCopy.messages.length; // By default, include all messages if messageId is null
        if (messageId !== null) {
          messageIndex = deepCopy.messages.findIndex(_m => _m.id === messageId);
          messageIndex = messageIndex >= 0 ? messageIndex + 1 : deepCopy.messages.length; // If message is found, include it
        }

        // title this branched chat differently
        const newTitle = getNextBranchTitle(conversationTitle(conversation));

        const branched: DConversation = {
          ...deepCopy,
          id: uuidv4(), // roll conversation ID
          messages: deepCopy.messages
            .slice(0, messageIndex)
            .map((message: DMessage): DMessage => ({
              ...message,
              id: uuidv4(), // roll message ID
              typing: false,
            })),
          updated: Date.now(),
          // Set the new title for the branched conversation
          autoTitle: newTitle,
          // reset transient
          abortController: null,
          // TODO: set references to parent conversation & message?
        };

        _set({
          conversations: [
            branched,
            ...conversations,
          ],
        });

        return branched.id;
      },

      deleteConversations: (conversationIds: DConversationId[], newConversationPersonaId?: SystemPurposeId): DConversationId => {
        let { conversations } = _get();

        // find the index of first conversation to delete
        const cIndex = conversationIds.length > 0 ? conversations.findIndex(_c => _c.id === conversationIds[0]) : -1;

        // abort all pending requests
        conversationIds.forEach(conversationId => conversations.find(_c => _c.id === conversationId)?.abortController?.abort());

        // remove from the list
        conversations = conversations.filter(_c => !conversationIds.includes(_c.id));

        // create a new conversation if there are no more
        if (!conversations.length)
          conversations.push(createDConversation(newConversationPersonaId));

        _set({
          conversations,
        });

        // return the next conversation Id in line, if valid
        return conversations[(cIndex >= 0 && cIndex < conversations.length) ? cIndex : 0].id;
      },


      // within a conversation

      _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) =>
        _set(state => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation =>
            conversation.id === conversationId
              ? {
                ...conversation,
                ...(typeof update === 'function' ? update(conversation) : update),
              }
              : conversation),
        })),

      setAbortController: (conversationId: string, abortController: AbortController | null) =>
        _get()._editConversation(conversationId, () =>
          ({
            abortController: abortController,
          })),

      stopTyping: (conversationId: string) =>
        _get()._editConversation(conversationId, conversation => {
          conversation.abortController?.abort();
          return {
            abortController: null,
          };
        }),

      setMessages: (conversationId: string, newMessages: DMessage[]) =>
        _get()._editConversation(conversationId, conversation => {
          conversation.abortController?.abort();
          return {
            messages: newMessages,
            ...(!!newMessages.length ? {} : {
              autoTitle: undefined,
            }),
            tokenCount: updateTokenCounts(newMessages, false, 'setMessages'),
            updated: Date.now(),
            abortController: null,
          };
        }),

      appendMessage: (conversationId: string, message: DMessage) =>
        _get()._editConversation(conversationId, conversation => {

          if (!message.typing)
            updateTokenCounts([message], true, 'appendMessage');

          const messages = [...conversation.messages, message];

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: Date.now(),
          };
        }),

      deleteMessage: (conversationId: string, messageId: string) =>
        _get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.filter(message => message.id !== messageId);

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: Date.now(),
          };
        }),

      editMessage: (conversationId: string, messageId: string, update: Partial<DMessage> | ((message: DMessage) => Partial<DMessage>), touchUpdated: boolean) =>
        _get()._editConversation(conversationId, conversation => {

          const chatLLMId = getChatLLMId();
          const messages = conversation.messages.map((message: DMessage): DMessage => {
            if (message.id === messageId) {
              const updatedMessage = typeof update === 'function' ? update(message) : update;
              return {
                ...message,
                ...updatedMessage,
                ...(touchUpdated && { updated: Date.now() }),
                ...(((updatedMessage.typing === false || !message.typing) && chatLLMId && {
                  tokenCount: countModelTokens(updatedMessage.text || message.text, chatLLMId, 'editMessage(typing=false)') ?? 0,
                })),
              };
            }
            return message;
          });

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: touchUpdated ? Date.now() : conversation.updated,
          };
        }),

      updateMetadata: (conversationId: string, messageId: string, metadataDelta: Partial<DMessageMetadata>, touchUpdated: boolean = true) => {
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

      setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) =>
        _get()._editConversation(conversationId,
          {
            systemPurposeId,
          }),

      setAutoTitle: (conversationId: string, autoTitle: string) =>
        _get()._editConversation(conversationId,
          {
            autoTitle,
          }),

      setUserTitle: (conversationId: string, userTitle: string) =>
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
       */
      version: 3,
      storage: createJSONStorage(() => idbStateStorage),

      // Migrations
      migrate: (persistedState: unknown, _fromVersion: number): ConversationsStore => {

        // other: just proceed
        return persistedState as any;
      },

      // Pre-Saving: remove transient properties
      partialize: (state) => ({
        ...state,
        conversations: state.conversations.map((conversation: DConversation) => {
          const {
            abortController,
            ...rest
          } = conversation;
          return rest;
        }),
      }),

      // Post-Loading: re-add transient properties and cleanup state
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // fixup state
        for (const conversation of (state.conversations || [])) {
          // reset the typing flag
          for (const message of conversation.messages)
            message.typing = false;

          // rehydrate the transient properties
          conversation.abortController = null;
        }
      },

    }),
  {
    name: 'AppChats',
    enabled: false,
  }),
);


export const conversationTitle = (conversation: DConversation, fallback?: string): string =>
  conversation.userTitle || conversation.autoTitle || fallback || ''; // 👋💬🗨️

function getNextBranchTitle(currentTitle: string): string {
  const numberPrefixRegex = /^\((\d+)\)\s+/; // Regex to find "(number) " at the beginning of the title
  const match = currentTitle.match(numberPrefixRegex);

  if (match) {
    const number = parseInt(match[1], 10) + 1;
    return currentTitle.replace(numberPrefixRegex, `(${number}) `);
  } else
    return `(1) ${currentTitle}`;
}


/**
 * Convenience function to count the tokens in a DMessage object
 */
function updateDMessageTokenCount(message: DMessage, llmId: DLLMId | null, forceUpdate: boolean, debugFrom: string): number {
  if (forceUpdate || !message.tokenCount)
    message.tokenCount = llmId ? countModelTokens(message.text, llmId, debugFrom) ?? 0 : 0;
  return message.tokenCount;
}

/**
 * Convenience function to update a set of messages, using the current chatLLM
 */
function updateTokenCounts(messages: DMessage[], forceUpdate: boolean, debugFrom: string): number {
  const chatLLMId = getChatLLMId();
  return 3 + messages.reduce((sum, message) => 4 + updateDMessageTokenCount(message, chatLLMId, forceUpdate, debugFrom) + sum, 0);
}

export const getConversation = (conversationId: DConversationId | null): DConversation | null =>
  conversationId ? useChatStore.getState().conversations.find(_c => _c.id === conversationId) ?? null : null;

export const getConversationSystemPurposeId = (conversationId: DConversationId | null): SystemPurposeId | null =>
  getConversation(conversationId)?.systemPurposeId || null;

export const useConversation = (conversationId: DConversationId | null) => useChatStore(state => {
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
}, shallow);
