import * as React from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatModelId, SystemPurposeId } from '@/lib/data';


/// Conversations Store

export interface ConversationsStore {
  conversations: DConversation[];
  activeConversationId: string | null;

  // store setters
  addConversation: (conversation: DConversation) => void;
  deleteConversation: (conversationId: string) => void;
  resetConversations: () => void;
  setActiveConversationId: (conversationId: string) => void;

  // conversation.others
  setChatModelId: (conversationId: string, chatModelId: ChatModelId) => void;
  setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => void;
  // conversation.messages
  addMessage: (conversationId: string, message: DMessage) => void;
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  replaceMessages: (conversationId: string, messages: DMessage[]) => void;
}

/**
 * Message, sent or received, by humans or bots
 *
 * Other ideas:
 * - modelTokensCount?: number;
 * - attachments?: {type: string; url: string; thumbnailUrl?: string; size?: number}[];
 * - isPinned?: boolean;
 * - reactions?: {type: string; count: number; users: string[]}[];
 * - status: 'sent' | 'delivered' | 'read' | 'failed';
 */
export interface DMessage {
  id: string;
  text: string;
  sender: 'You' | 'Bot' | string;
  role: 'assistant' | 'system' | 'user';
  modelName?: string;         // optional for 'assistant' roles (not user messages)
  modelTokensCount?: number;  // optional
  avatar: string | null;
  created: number;            // created timestamp
  updated: number | null;     // updated timestamp
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
  modelTokensCount?: number;
  created: number;            // created timestamp
  updated: number | null;     // updated timestamp
}

const createConversation = (id: string, name: string, systemPurposeId: SystemPurposeId, chatModelId: ChatModelId): DConversation =>
  ({ id, name, messages: [], systemPurposeId, chatModelId, created: Date.now(), updated: Date.now() });

const defaultConversations: DConversation[] = [createConversation('default', 'Conversation', 'Generic', 'gpt-4')];

const errorConversation: DConversation = createConversation('error-missing', 'Missing Conversation', 'Developer', 'gpt-3.5-turbo');


export const useChatStore = create<ConversationsStore>()(
  persist((set) => ({
      // default state
      conversations: defaultConversations,
      activeConversationId: defaultConversations[0].id,

      addConversation(conversation: DConversation) {
        set((state) => (
          {
            conversations: [
              conversation,
              ...state.conversations.slice(0, 19),
            ],
          }
        ));
      },

      deleteConversation: (conversationId: string) => {
        set((state) => (
          {
            conversations: state.conversations.filter((conversation: DConversation): boolean => conversation.id !== conversationId),
          }
        ));
      },

      resetConversations: () => set({ conversations: defaultConversations }),

      setActiveConversationId: (conversationId: string) =>
        set({ activeConversationId: conversationId }),

      addMessage: (conversationId: string, message: DMessage) => {
        set((state) => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation => ({
            ...conversation,
            ...(conversation.id !== conversationId ? {} : {
              messages: [...conversation.messages, message],
              modelTokensCount: (conversation.modelTokensCount || 0) + (message.modelTokensCount || 0),
              updated: Date.now(),
            }),
          })),
        }));
      },

      editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>) => {
        set((state) => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation => {
            if (conversation.id === conversationId) {

              const newMessages = conversation.messages.map((message: DMessage): DMessage => {
                if (message.id === messageId)
                  return {
                    ...message,
                    ...updatedMessage,
                    updated: Date.now(),
                  };
                return message;
              });

              return {
                ...conversation,
                messages: newMessages,
                modelTokensCount: newMessages.reduce((sum, message) => sum + (message.modelTokensCount || 0), 0),
                updated: Date.now(),
              };
            }
            return conversation;
          }),
        }));
      },

      removeMessage: (conversationId: string, messageId: string) => {
        set((state) => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation => {
            if (conversation.id === conversationId) {

              const newMessages = conversation.messages.filter((message: DMessage): boolean => message.id !== messageId);

              return {
                ...conversation,
                messages: newMessages,
                modelTokensCount: newMessages.reduce((sum, message) => sum + (message.modelTokensCount || 0), 0),
                updated: Date.now(),
              };
            }
            return conversation;
          }),
        }));
      },

      replaceMessages: (conversationId: string, messages: DMessage[]) => {
        set((state) => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation => {
            if (conversation.id === conversationId) {
              return {
                ...conversation,
                messages,
                modelTokensCount: messages.reduce((sum, message) => sum + (message.modelTokensCount || 0), 0),
                updated: Date.now(),
              };
            }
            return conversation;
          }),
        }));
      },

      setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => {
        set((state) => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation => {
            if (conversation.id === conversationId) {
              return {
                ...conversation,
                systemPurposeId,
                updated: Date.now(),
              };
            }
            return conversation;
          }),
        }));
      },

      setChatModelId: (conversationId: string, chatModelId: ChatModelId) => {
        set((state) => ({
          conversations: state.conversations.map((conversation: DConversation): DConversation => {
            if (conversation.id === conversationId) {
              // TODO: recalculate modelTokensCount?
              return {
                ...conversation,
                chatModelId,
                updated: Date.now(),
              };
            }
            return conversation;
          }),
        }));
      },

    }),
    {
      name: 'app-chats',
    }),
);


export const useActiveConversation = (): DConversation => {
  const activeConversationId = useChatStore(state => state.activeConversationId);
  return useChatStore(state => (state.conversations.find((conversation) => conversation.id === activeConversationId) || errorConversation));
};

export const useActiveConfiguration = () => {
  const activeConversation = useActiveConversation();

  const setSystemPurposeId = React.useCallback((systemPurposeId: SystemPurposeId) => {
    useChatStore.getState().setSystemPurposeId(activeConversation.id, systemPurposeId);
  }, [activeConversation.id]);

  const setChatModelId = React.useCallback((chatModelId: ChatModelId) => {
    useChatStore.getState().setChatModelId(activeConversation.id, chatModelId);
  }, [activeConversation.id]);

  return {
    systemPurposeId: activeConversation.systemPurposeId,
    chatModelId: activeConversation.chatModelId,
    setSystemPurposeId,
    setChatModelId,
  };
};

export const useConversationNames = (): { id: string, name: string }[] => useChatStore((state) =>
  state.conversations.map((conversation) => ({ id: conversation.id, name: conversation.name })),
);