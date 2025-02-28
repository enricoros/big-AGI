import { useShallow } from 'zustand/react/shallow';

import { conversationTitle, DConversationId } from '../chat.conversation';
import { useChatStore } from '../store-chats';


export function useConversationTitle(conversationId: DConversationId | null) {
  return useChatStore(useShallow(({ conversations }) => {
    const conversation = conversationId ? conversations.find(_c => _c.id === conversationId) : null;
    return conversation ? conversationTitle(conversation) : null;
  }));
}
