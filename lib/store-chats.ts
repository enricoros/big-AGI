import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ChatModelId, SystemPurposeId } from '@/lib/data';


/// Conversations Store

export interface ConversationsStore {
  conversations: DConversation[];
  activeConversationId: string | null;

  addConversation: (conversation: DConversation) => void;
  setActiveConversationId: (conversationId: string) => void;
  addMessage: (conversationId: string, message: DMessage) => void;
  editMessage: (conversationId: string, messageId: string, updatedMessage: Partial<DMessage>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  replaceMessages: (conversationId: string, messages: DMessage[]) => void;

  // systemPurposeId: (conversationId: string) => SystemPurposeId;
  // setSystemPurposeId: (conversationId: string, systemPurposeId: SystemPurposeId) => void;
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

function createDefaultConversation(): DConversation {
  return {
    id: 'default-conversation',
    name: 'No Active Conversation',
    messages: [],
    systemPurposeId: 'Generic',
    chatModelId: 'gpt-4',
    created: Date.now(),
    updated: Date.now(),
  };
}


export const useChatStore = create<ConversationsStore>()(
  persist((set) => ({
      // default state
      conversations: [createDefaultConversation()],
      activeConversationId: 'default-conversation',

      addConversation: (conversation: DConversation) => {
        set((state) => {
          const newConversations =
            state.conversations.length >= 10
              ? [conversation, ...state.conversations.slice(0, -1)]
              : [conversation, ...state.conversations];

          return { conversations: newConversations };
        });
      },

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

    }),
    {
      name: 'app-chats',
    }),
);


const errorConversation = createDefaultConversation();

export const useActiveConversation = (): DConversation => {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  return useChatStore(
    (state) => state.conversations.find((conversation) => conversation.id === activeConversationId) || errorConversation,
  );
};

export const useConversationNames = (): { id: string, name: string }[] => useChatStore((state) =>
  state.conversations.map((conversation) => ({ id: conversation.id, name: conversation.name })),
);