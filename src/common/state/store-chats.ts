import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

import { ChatModelId, defaultChatModelId, defaultSystemPurposeId, SystemPurposeId } from '../../data';
import { updateTokenCount } from '../llm-util/token-counter';


// configuration
export const MAX_CONVERSATIONS = 10;

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
  chatModelId: ChatModelId;
  userTitle?: string;
  autoTitle?: string;
  tokenCount: number;                 // f(messages, chatModelId)
  created: number;                    // created timestamp
  updated: number | null;             // updated timestamp
  // Not persisted, used while in-memory, or temporarily by the UI
  abortController: AbortController | null;
  ephemerals: DEphemeral[];
}

export const createDefaultConversation = (systemPurposeId?: SystemPurposeId, chatModelId?: ChatModelId): DConversation => ({
  id: uuidv4(),
  messages: [],
  systemPurposeId: systemPurposeId || defaultSystemPurposeId,
  chatModelId: chatModelId || defaultChatModelId,
  tokenCount: 0,
  created: Date.now(),
  updated: Date.now(),
  abortController: null,
  ephemerals: [],
});

export const conversationTitle = (conversation: DConversation): string =>
  conversation.userTitle || conversation.autoTitle || 'new conversation'; // 👋💬🗨️

const defaultConversations: DConversation[] = [createDefaultConversation()];

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

export const createDMessage = (role: DMessage['role'], text: string): DMessage =>
  ({
    id: uuidv4(),
    text,
    sender: role === 'user' ? 'You' : 'Bot',
    avatar: null,
    typing: false,
    role: role,
    tokenCount: 0,
    created: Date.now(),
    updated: null,
  });

/**
 * InterimStep, a place side-channel information is displayed
 */
export interface DEphemeral {
  id: string;
  title: string;
  text: string;
}

export const createEphemeral = (title: string, initialText: string): DEphemeral => ({
  id: uuidv4(),
  title: title,
  text: initialText,
});


/// Conversations Store


export interface ChatStore {
  conversations: DConversation[];
  activeConversationId: string | null;

  // store setters
  createConversation: () => void;
  importConversation: (conversation: DConversation) => void;
  deleteConversation: (conversationId: string) => void;
  setActiveConversationId: (conversationId: string) => void;

  // within a conversation
  startTyping: (conversationId: string, abortController: AbortController | null) => void;
  stopTyping: (conversationId: string) => void;
  setMessages: (conversationId: string, messages: DMessage[]) => void;
  appendMessage: (conversationId: string, message: DMessage) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) => void;
  setChatModelId: (conversationId: string, chatModelId: ChatModelId) => void;
  setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => void;
  setAutoTitle: (conversationId: string, autoTitle: string) => void;
  setUserTitle: (conversationId: string, userTitle: string) => void;

  appendEphemeral: (conversationId: string, devTool: DEphemeral) => void;
  deleteEphemeral: (conversationId: string, ephemeralId: string) => void;
  updateEphemeralText: (conversationId: string, ephemeralId: string, text: string) => void;

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
          const conversation = createDefaultConversation(activeConversation?.systemPurposeId, activeConversation?.chatModelId);
          return {
            conversations: [
              conversation,
              ...state.conversations.slice(0, MAX_CONVERSATIONS - 1),
            ],
            activeConversationId: conversation.id,
          };
        }),

      importConversation: (conversation: DConversation) => {
        get().deleteConversation(conversation.id);
        set(state => {
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
            tokenCount: newMessages.reduce((sum, message) => sum + 4 + updateTokenCount(message, conversation.chatModelId, false, 'setMessages'), 3),
            updated: Date.now(),
            abortController: null,
            ephemerals: [],
          };
        }),

      appendMessage: (conversationId: string, message: DMessage) =>
        get()._editConversation(conversationId, conversation => {

          if (!message.typing)
            updateTokenCount(message, conversation.chatModelId, true, 'appendMessage');

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

          const messages = conversation.messages.map((message: DMessage): DMessage =>
            message.id === messageId
              ? {
                ...message,
                ...updatedMessage,
                ...(setUpdated && { updated: Date.now() }),
                ...(((updatedMessage.typing === false || !message.typing) && { tokenCount: updateTokenCount(message, conversation.chatModelId, true, 'editMessage(typing=false)') })),
              }
              : message);

          return {
            messages,
            tokenCount: messages.reduce((sum, message) => sum + 4 + message.tokenCount || 0, 3),
            ...(setUpdated && { updated: Date.now() }),
          };
        }),

      setChatModelId: (conversationId: string, chatModelId: ChatModelId) =>
        get()._editConversation(conversationId, conversation => {
          return {
            chatModelId,
            tokenCount: conversation.messages.reduce((sum, message) => sum + 4 + updateTokenCount(message, chatModelId, true, 'setChatModelId'), 3),
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
              ? {
                ...e,
                text,
              }
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
 * Download a conversation as a JSON file, for backup and future restore
 * Not the best place to have this function, but we want it close to the (re)store function
 */
export const downloadConversationJson = (_conversation: DConversation) => {
  if (typeof window === 'undefined') return;

  // payload to be downloaded
  const { abortController, ephemerals, ...conversation } = _conversation;
  const json = JSON.stringify(conversation, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `conversation-${conversation.id}.json`;

  // link to begin the download
  const tempUrl = URL.createObjectURL(blob);
  const tempLink = document.createElement('a');
  tempLink.href = tempUrl;
  tempLink.download = filename;
  tempLink.style.display = 'none';
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  URL.revokeObjectURL(tempUrl);
};

/**
 * Restore a conversation from a JSON string
 */
export const restoreConversationFromJson = (json: string): DConversation | null => {
  const restored: Partial<DConversation> = JSON.parse(json);
  if (restored && restored.id && restored.messages) {
    return {
      id: restored.id,
      messages: restored.messages,
      systemPurposeId: restored.systemPurposeId || defaultSystemPurposeId,
      chatModelId: restored.chatModelId || defaultChatModelId,
      // ...(restored.userTitle && { userTitle: restored.userTitle }),
      // ...(restored.autoTitle && { autoTitle: restored.autoTitle }),
      tokenCount: restored.tokenCount || 0,
      created: restored.created || Date.now(),
      updated: restored.updated || Date.now(),
      abortController: null,
      ephemerals: [],
    } satisfies DConversation;
  }
  return null;
};