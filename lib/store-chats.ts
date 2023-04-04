import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';

import { ChatModelId, defaultChatModelId, SystemPurposeId } from '@/lib/data';


/// Conversations Store

export interface ChatStore {
  conversations: DConversation[];
  activeConversationId: string | null;

  // store setters
  addConversation: (conversation: DConversation) => void;
  deleteConversation: (conversationId: string) => void;
  setActiveConversationId: (conversationId: string) => void;

  // within a conversation
  setMessages: (conversationId: string, messages: DMessage[]) => void;
  appendMessage: (conversationId: string, message: DMessage) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) => void;
  setChatModelId: (conversationId: string, chatModelId: ChatModelId) => void;
  setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => void;

  // utility function
  _editConversation: (conversationId: string, update: Partial<DConversation> | ((conversation: DConversation) => Partial<DConversation>)) => void;
}

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

  modelId?: string;                 // only assistant - goes beyond known models
  purposeId?: SystemPurposeId;      // only assistant/system
  cacheTokensCount?: number;

  created: number;                  // created timestamp
  updated: number | null;           // updated timestamp
}

/**
 * Conversation, a list of messages between humans and bots
 * Future:
 * - sumTokensCount?: number;
 * - draftUserMessage?: { text: string; attachments: any[] };
 * - isMuted: boolean; isArchived: boolean; isStarred: boolean; participants: string[];
 */
export interface DConversation {
  id: string;
  name: string;
  messages: DMessage[];
  systemPurposeId: SystemPurposeId;
  chatModelId: ChatModelId;
  userTitle?: string;
  autoTitle?: string;
  cacheTokensCount?: number;
  created: number;            // created timestamp
  updated: number | null;     // updated timestamp
}

const createConversation = (id: string, name: string, systemPurposeId: SystemPurposeId, chatModelId: ChatModelId): DConversation =>
  ({ id, name, messages: [], systemPurposeId, chatModelId, created: Date.now(), updated: Date.now() });

const defaultConversations: DConversation[] = [createConversation('default', 'Conversation', 'Generic', defaultChatModelId)];

const errorConversation: DConversation = createConversation('error-missing', 'Missing Conversation', 'Developer', defaultChatModelId);


export const useChatStore = create<ChatStore>()(devtools(
  persist(
    (set, get) => ({
      // default state
      conversations: defaultConversations,
      activeConversationId: defaultConversations[0].id,


      addConversation: (conversation: DConversation) =>
        set(state => (
          {
            conversations: [
              conversation,
              ...state.conversations.slice(0, 19),
            ],
          }
        )),

      deleteConversation: (conversationId: string) =>
        set(state => (
          {
            conversations: state.conversations.filter((conversation: DConversation): boolean => conversation.id !== conversationId),
          }
        )),

      setActiveConversationId: (conversationId: string) =>
        set({ activeConversationId: conversationId }),


      // within a conversation

      setMessages: (conversationId: string, newMessages: DMessage[]) =>
        get()._editConversation(conversationId,
          {
            messages: newMessages,
            // cacheTokensCount: newMessages.reduce((sum, message) => sum + (message.cacheTokensCount || 0), 0),
            updated: Date.now(),
          },
        ),

      appendMessage: (conversationId: string, message: DMessage) =>
        get()._editConversation(conversationId, conversation => {

          const messages = [...conversation.messages, message];

          return {
            messages,
            // DISABLE THE FOLLOWING FOR NOW - as we haven't decided how to handle token counts
            // cacheTokensCount: (conversation.cacheTokensCount || 0) + (message.cacheTokensCount || 0),
            updated: Date.now(),
          };
        }),

      deleteMessage: (conversationId: string, messageId: string) =>
        get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.filter(message => message.id !== messageId);

          return {
            messages,
            // cacheTokensCount: messages.reduce((sum, message) => sum + (message.cacheTokensCount || 0), 0),
            updated: Date.now(),
          };
        }),

      editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>, touch: boolean) =>
        get()._editConversation(conversationId, conversation => {

          const messages = conversation.messages.map((message: DMessage): DMessage =>
            message.id === messageId
              ? {
                ...message,
                ...updatedMessage,
                ...(touch ? { updated: Date.now() } : {}),
              }
              : message);

          return {
            messages,
            // cacheTokensCount: messages.reduce((sum, message) => sum + (message.cacheTokensCount || 0), 0),
            ...(touch ? { updated: Date.now() } : {}),
          };
        }),

      setChatModelId: (conversationId: string, chatModelId: ChatModelId) =>
        get()._editConversation(conversationId,
          {
            chatModelId,
          }),

      setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) =>
        get()._editConversation(conversationId,
          {
            systemPurposeId,
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
    }),
  {
    name: 'AppChats',
    enabled: false,
  }),
);


// WARNING: this will re-render at high frequency (e.g. token received in any message therein)
//          only use this for UI that renders messages
export function useActiveConversation(): DConversation {
  const activeConversationId = useChatStore(state => state.activeConversationId);
  return useChatStore(state => state.conversations.find(conversation => conversation.id === activeConversationId) || errorConversation);
}

export function useActiveConfiguration() {
  const { conversationId, chatModelId, setChatModelId, systemPurposeId, setSystemPurposeId } = useChatStore(state => {
    const _activeConversationId = state.activeConversationId;
    const conversation = state.conversations.find(conversation => conversation.id === _activeConversationId) || errorConversation;
    return {
      conversationId: conversation.id,
      chatModelId: conversation.chatModelId,
      setChatModelId: state.setChatModelId,
      systemPurposeId: conversation.systemPurposeId,
      setSystemPurposeId: state.setSystemPurposeId,
    };
  }, shallow);

  return {
    conversationId,
    chatModelId,
    setChatModelId: (chatModelId: ChatModelId) => setChatModelId(conversationId, chatModelId),
    systemPurposeId,
    setSystemPurposeId: (systemPurposeId: SystemPurposeId) => setSystemPurposeId(conversationId, systemPurposeId),
  };
}

export const useConversationNames = (): { id: string, name: string, systemPurposeId: SystemPurposeId }[] =>
  useChatStore(
    state => state.conversations.map((conversation) => ({ id: conversation.id, name: conversation.name, systemPurposeId: conversation.systemPurposeId })),
    shallow,
  );