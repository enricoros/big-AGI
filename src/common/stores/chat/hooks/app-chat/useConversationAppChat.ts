import type { DConversationId } from '../../chat.conversation';
import { useChatStore } from '../../store-chats';


/**
 * Emptiness of a conversation; true when missing.
 */
export function useConversationIsEmpty(conversationId: DConversationId | null): boolean {
  return useChatStore(({ conversations }) => {
    const conversation = !conversationId ? undefined : conversations.find(_c => _c.id === conversationId);
    return conversation ? !conversation.messages.length : true;
  });
}

/**
 * Role of the last message of a conversation; undefined when missing or without messages.
 */
export function useConversationLastMessageRole(conversationId: DConversationId | null) {
  return useChatStore(({ conversations }) => {
    const conversation = !conversationId ? undefined : conversations.find(_c => _c.id === conversationId);
    return conversation?.messages.at(-1)?.role;
  });
}
