import type { DConversationId } from '~/common/stores/chat/chat.conversation';

/**
 * Not well defined for now, and mapping to DConversations, but we'll define this properly in the future
 * Makes searching for conversations easier
 */
export type DWorkspaceId = string;


/**
 * Make the shortcut of having conversation=workspace evident and searchable.
 */
export function workspaceForConversationIdentity<T extends DConversationId | null>(conversationId: T): T {
  return conversationId;
}
