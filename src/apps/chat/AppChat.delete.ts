import type { DConversationId } from '~/common/stores/chat/chat.conversation';

export function getConversationToFocusAfterDeletion(params: {
  deletedConversationIds: DConversationId[];
  focusedConversationId: DConversationId | null;
  nextConversationId: DConversationId;
}): DConversationId {
  if (!params.focusedConversationId)
    return params.nextConversationId;

  return params.deletedConversationIds.includes(params.focusedConversationId)
    ? params.nextConversationId
    : params.focusedConversationId;
}
