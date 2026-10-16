import * as React from 'react';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';

import { useFolderStore } from '../store-chat-folders';


export function useChatFoldersForConversation(conversationId: DConversationId | null) {
  const allFolders = useFolderStore(state => state.folders);

  // find current folder for this conversation
  const currentFolder = React.useMemo(() => {
    if (!conversationId) return null;
    return allFolders.find(folder => folder.conversationIds.includes(conversationId)) || null;
  }, [allFolders, conversationId]);

  return {
    allFolders,
    currentFolder,
  };
}
