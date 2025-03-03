import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { conversationTitle, DConversationId } from '../chat.conversation';
import { useChatStore } from '../store-chats';


export function useConversationTitle(conversationId: DConversationId | null, fallbackTitle?: string) {

  // react to the title
  const { title, setUserTitle: storeSetUserTitle } = useChatStore(useShallow(({ conversations, setUserTitle }) => {
    const conversation = conversationId ? conversations.find(_c => _c.id === conversationId) : null;
    return {
      title: conversation ? conversationTitle(conversation, fallbackTitle) : null,
      setUserTitle,
    };
  }));

  // closure to set the title
  const setUserTitle = React.useCallback((newTitle: string) => {
    conversationId && storeSetUserTitle(conversationId, newTitle);
  }, [conversationId, storeSetUserTitle]);

  return { title, setUserTitle };
}
