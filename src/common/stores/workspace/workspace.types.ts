import type { DConversationId } from '~/common/stores/chat/chat.conversation';

/**
 * Not well defined for now, and mapping to DConversations, but we'll define this properly in the future
 * Makes searching for conversations easier
 */
export type DWorkspaceId = string;

// this is just used as a future architecture placeholder
export function workspaceForConversationIdentity(conversationId: DConversationId): DWorkspaceId {
  return conversationId;
}
