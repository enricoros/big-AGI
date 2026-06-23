import * as React from 'react';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import { useChatStore } from '~/common/stores/chat/store-chats';


/**
 * Inline-rename state for the conversation title shown in the top bar (used by ChatBarBreadcrumbs).
 * Commits go through the chat store's setUserTitle (only the title field changes).
 *
 * Line-agnostic by design: depends only on primitives that exist identically on `main` and `dev`
 * (`useChatStore.setUserTitle`), so this file - and ChatBarBreadcrumbs - are byte-identical across branches
 * and live on `main`; `dev` inherits them unchanged on rebase.
 */
export function useEditableConversationTitle(conversationId: DConversationId | null) {

  const [isEditing, setIsEditing] = React.useState(false);

  const beginEdit = React.useCallback(() => {
    if (conversationId) setIsEditing(true);
  }, [conversationId]);

  const commitEdit = React.useCallback((text: string) => {
    if (conversationId)
      useChatStore.getState().setUserTitle(conversationId, text.trim());
    setIsEditing(false);
  }, [conversationId]);

  const cancelEdit = React.useCallback(() => {
    setIsEditing(false);
  }, []);

  return { isEditing, beginEdit, commitEdit, cancelEdit };
}
