import { defaultSystemPurposeId } from '../../data';

import { DConversation } from '~/common/state/store-chats';

/**
 * Download a conversation as a JSON file, for backup and future restore
 * Not the best place to have this function, but we want it close to the (re)store function
 */
export const downloadConversationJson = (_conversation: DConversation) => {
  if (typeof window === 'undefined') return;

  // payload to be downloaded
  const { abortController, ephemerals, ...conversation } = _conversation;
  const json = JSON.stringify(conversation, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `conversation-${conversation.id}.json`;

  // link to begin the download
  const tempUrl = URL.createObjectURL(blob);
  const tempLink = document.createElement('a');
  tempLink.href = tempUrl;
  tempLink.download = filename;
  tempLink.style.display = 'none';
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  URL.revokeObjectURL(tempUrl);
};

/**
 * Restore a conversation from a JSON string
 */
export const restoreConversationFromJson = (json: string): DConversation | null => {
  const restored: Partial<DConversation> = JSON.parse(json);
  if (restored && restored.id && restored.messages) {
    return {
      id: restored.id,
      messages: restored.messages,
      systemPurposeId: restored.systemPurposeId || defaultSystemPurposeId,
      // ...(restored.userTitle && { userTitle: restored.userTitle }),
      // ...(restored.autoTitle && { autoTitle: restored.autoTitle }),
      tokenCount: restored.tokenCount || 0,
      created: restored.created || Date.now(),
      updated: restored.updated || Date.now(),
      abortController: null,
      ephemerals: [],
    } satisfies DConversation;
  }
  return null;
};