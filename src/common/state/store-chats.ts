import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import { DLLMId } from '~/modules/llms/llm.types';
import { useModelsStore } from '~/modules/llms/store-llms';

import { countModelTokens } from '../util/token-counter';
import { defaultSystemPurposeId, SystemPurposeId } from '../../data';


// configuration
export const MAX_CONVERSATIONS = 20;


/**
 * Conversation, a list of messages between humans and bots
 * Future:
 * - draftUserMessage?: { text: string; attachments: any[] };
 * - isMuted: boolean; isArchived: boolean; isStarred: boolean; participants: string[];
 */
export interface DConversation {
  id: string;
  messages: DMessage[];
  systemPurposeId: SystemPurposeId;
  userTitle?: string;
  autoTitle?: string;
  tokenCount: number;                 // f(messages, llmId)
  created: number;                    // created timestamp
  updated: number | null;             // updated timestamp
  // Not persisted, used while in-memory, or temporarily by the UI
  abortController: AbortController | null;
  ephemerals: DEphemeral[];
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
    ephemerals: [],
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

  tokenCount: number;               // cache for token count, using the current Conversation model (0 = not yet calculated)

  created: number;                  // created timestamp
  updated: number | null;           // updated timestamp
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

/**
 * InterimStep, a place side-channel information is displayed
 */
export interface DEphemeral {
  id: string;
  title: string;
  text: string;
  state: object;
}

export function createDEphemeral(title: string, initialText: string): DEphemeral {
  return {
    id: uuidv4(),
    title: title,
    text: initialText,
    state: {},
  };
}


/// Conversations Store


export interface ChatStore {
  conversations: DConversation[];
  activeConversationId: string | null;

  // store setters
  createConversation: () => void;
  duplicateConversation: (conversationId: string) => void;
  importConversation: (conversation: DConversation) => void;
  deleteConversation: (conversationId: string) => void;
  deleteAllConversations: () => void;
  setActiveConversationId: (conversationId: string) => void;

  // within a conversation
  startTyping: (conversationId: string, abortController: AbortController | null) => void;
  stopTyping: (conversationId: string) => void;
  setMessages: (conversationId: string, messages: DMessage[]) => void;
  appendMessage: (conversationId: string, message: DMessage) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) => void;
  setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => void;
  setAutoTitle: (conversationId: string, autoTitle: string) => void;
  setUserTitle: (conversationId: string, userTitle: string) => void;

  appendEphemeral: (conversationId: string, devTool: DEphemeral) => void;
  deleteEphemeral: (conversationId: string, ephemeralId: string) => void;
  updateEphemeralText: (conversationId: string, ephemeralId: string, text: string) => void;
  updateEphemeralState: (conversationId: string, ephemeralId: string, state: object) => void;

  // utility function
  _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) => void;
}

export const useChatStore = create<ChatStore>()(devtools(
  persist(
    (set, get) => ({

      // default state
      conversations: defaultConversations,
      activeConversationId: defaultConversations[0].id,


      createConversation: () =>
        set(state => {
          // inherit some values from the active conversation (matches users' expectations)
          const activeConversation = state.conversations.find((conversation: DConversation): boolean => conversation.id === state.activeConversationId);
          const conversation = createDConversation(activeConversation?.systemPurposeId);
          return {
            conversations: [
              conversation,
              ...state.conversations.slice(0, MAX_CONVERSATIONS - 1),
            ],
            activeConversationId: conversation.id,
          };
        }),

      duplicateConversation: (conversationId: string) =>
        set(state => {
          const conversation = state.conversations.find((conversation: DConversation): boolean => conversation.id === conversationId);
          if (!conversation)
            return {};

          // create a deep copy of the conversation
          const deepCopy: DConversation = JSON.parse(JSON.stringify(conversation));
          const duplicate: DConversation = {
            ...deepCopy,
            id: uuidv4(),
            messages: deepCopy.messages.map((message: DMessage): DMessage => ({
              ...message,
              id: uuidv4(),
            })),
            updated: Date.now(),
            abortController: null,
            ephemerals: [],
          };

          return {
            conversations: [
              duplicate,
              ...state.conversations, // DISABLED: can inadvertendly lose data - check upstream instead - .slice(0, MAX_CONVERSATIONS - 1),
            ],
            activeConversationId: duplicate.id,
          };
        }),

      importConversation: (conversation: DConversation) => {
        get().deleteConversation(conversation.id);
        set(state => {
          conversation.tokenCount = updateTokenCounts(conversation.messages, true, 'importConversation');
          return {
            // NOTE: the .filter below is superfluous (we delete the conversation above), but it's a reminder that we don't want to corrupt the state
            conversations: [
              conversation,
              ...state.conversations.filter(other => other.id !== conversation.id).slice(0, MAX_CONVERSATIONS - 1),
            ],
            activeConversationId: conversation.id,
          };
        });
      },

      deleteConversation: (conversationId: string) =>
        set(state => {

          // abort any pending requests on this conversation
          const cIndex = state.conversations.findIndex((conversation: DConversation): boolean => conversation.id === conversationId);
          if (cIndex >= 0)
            state.conversations[cIndex].abortController?.abort();

          // remove from the list
          const conversations = state.conversations.filter((conversation: DConversation): boolean => conversation.id !== conversationId);

          // update the active conversation to the next in list
          let activeConversationId = undefined;
          if (state.activeConversationId === conversationId && cIndex >= 0)
            activeConversationId = conversations.length
              ? conversations[cIndex < conversations.length ? cIndex : conversations.length - 1].id
              : null;

          return {
            conversations,
            ...(activeConversationId !== undefined ? { activeConversationId } : {}),
          };
        }),

      deleteAllConversations: () => {
        set(state => {
          // inherit some values from the active conversation (matches users' expectations)
          const activeConversation = state.conversations.find((conversation: DConversation): boolean => conversation.id === state.activeConversationId);
          const conversation = createDConversation(activeConversation?.systemPurposeId);

          // abort any pending requests on all conversations
          state.conversations.forEach((conversation: DConversation) => conversation.abortController?.abort());

          // delete all, but be left with one
          return {
            conversations: [conversation],
            activeConversationId: conversation.id,
          };
        });
      },

      setActiveConversationId: (conversationId: string) =>
        set({ activeConversationId: conversationId }),


      // within a conversation

      startTyping: (conversationId: string, abortController: AbortController | null) =>
        get()._editConversation(conversationId, () =>
          ({
            abortController: abortController,
          })),

      stopTyping: (conversationId: string) =>
        get()._editConversation(conversationId, conversation => {
          conversation.abortController?.abort();
          return {
            abortController: null,
          };
        }),

      setMessages: (conversationId: string, newMessages: DMessage[]) =>
        get()._editConversation(conversationId, conversation => {
          conversation.abortController?.abort();
          return {
            messages: newMessages,
            tokenCount: updateTokenCounts(newMessages, false, 'setMessages'),
            updated: Date.now(),
            abortController: null,
            ephemerals: [],
          };
        }),

      appendMessage: (conversationId: string, message: DMessage) =>
        get()._editConversation(conversationId, conversation => {

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
        get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.filter(message => message.id !== messageId);

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            updated: Date.now(),
          };
        }),

      editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, setUpdated: boolean) =>
        get()._editConversation(conversationId, conversation => {

          const chatLLMId = useModelsStore.getState().chatLLMId;
          const messages = conversation.messages.map((message: DMessage): DMessage =>
            message.id === messageId
              ? {
                ...message,
                ...updatedMessage,
                ...(setUpdated && { updated: Date.now() }),
                ...(((updatedMessage.typing === false || !message.typing) && chatLLMId && {
                  tokenCount: countModelTokens(updatedMessage.text || message.text, chatLLMId, 'editMessage(typing=false)'),
                })),
              }
              : message);

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            ...(setUpdated && { updated: Date.now() }),
          };
        }),

      setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) =>
        get()._editConversation(conversationId,
          {
            systemPurposeId,
          }),

      setAutoTitle: (conversationId: string, autoTitle: string) =>
        get()._editConversation(conversationId,
          {
            autoTitle,
          }),

      setUserTitle: (conversationId: string, userTitle: string) =>
        get()._editConversation(conversationId,
          {
            userTitle,
          }),

      appendEphemeral: (conversationId: string, ephemeral: DEphemeral) =>
        get()._editConversation(conversationId, conversation => {
          const ephemerals = [...conversation.ephemerals, ephemeral];
          return {
            ephemerals,
          };
        }),

      deleteEphemeral: (conversationId: string, ephemeralId: string) =>
        get()._editConversation(conversationId, conversation => {
          const ephemerals = conversation.ephemerals?.filter((e: DEphemeral): boolean => e.id !== ephemeralId) || [];
          return {
            ephemerals,
          };
        }),

      updateEphemeralText: (conversationId: string, ephemeralId: string, text: string) =>
        get()._editConversation(conversationId, conversation => {
          const ephemerals = conversation.ephemerals?.map((e: DEphemeral): DEphemeral =>
            e.id === ephemeralId
              ? { ...e, text }
              : e) || [];
          return {
            ephemerals,
          };
        }),

      updateEphemeralState: (conversationId: string, ephemeralId: string, state: object) =>
        get()._editConversation(conversationId, conversation => {
          const ephemerals = conversation.ephemerals?.map((e: DEphemeral): DEphemeral =>
            e.id === ephemeralId
              ? { ...e, state: state }
              : e) || [];
          return {
            ephemerals,
          };
        }),

      _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) =>
        set(state => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation =>
            conversation.id === conversationId
              ? {
                ...conversation,
                ...(typeof update === 'function' ? update(conversation) : update),
              }
              : conversation),
        })),

    }),
    {
      name: 'app-chats',
      // version history:
      //  - 1: [2023-03-18] app launch, single chat
      //  - 2: [2023-04-10] multi-chat version - invalidating data to be sure
      version: 2,

      // omit the transient property from the persisted state
      partialize: (state) => ({
        ...state,
        conversations: state.conversations.map((conversation: DConversation) => {
          const {
            abortController, ephemerals,
            ...rest
          } = conversation;
          return rest;
        }),
      }),

      onRehydrateStorage: () => (state) => {
        if (state) {
          // if nothing is selected, select the first conversation
          if (!state.activeConversationId && state.conversations.length)
            state.activeConversationId = state.conversations[0].id;

          for (const conversation of (state.conversations || [])) {
            // fixup stale state
            for (const message of conversation.messages)
              message.typing = false;

            // rehydrate the transient properties
            conversation.abortController = null;
            conversation.ephemerals = [];
          }
        }
      },
    }),
  {
    name: 'AppChats',
    enabled: false,
  }),
);


/**
 * Convenience function to count the tokens in a DMessage object
 */
function updateDMessageTokenCount(message: DMessage, llmId: DLLMId | null, forceUpdate: boolean, debugFrom: string): number {
  if (forceUpdate || !message.tokenCount)
    message.tokenCount = llmId ? countModelTokens(message.text, llmId, debugFrom) : 0;
  return message.tokenCount;
}

/**
 * Convenience function to update a set of messages, using the current chatLLM
 */
function updateTokenCounts(messages: DMessage[], forceUpdate: boolean, debugFrom: string): number {
  const { chatLLMId } = useModelsStore.getState();
  return 3 + messages.reduce((sum, message) => 4 + updateDMessageTokenCount(message, chatLLMId, forceUpdate, debugFrom) + sum, 0);
}