import { defaultSystemPurposeId } from '../../../data';

import { DModelSource } from '~/modules/llms/llm.types';
import { useModelsStore } from '~/modules/llms/store-llms';

import { DConversation, useChatStore } from '~/common/state/store-chats';


/**
 * Download a conversation as a JSON file, for backup and future restore
 */
export function downloadDConversationJson(conversation: DConversation): boolean {
  // remove fields from the export
  const exportableConversation = cleanConversationForExport(conversation);
  const json = JSON.stringify(exportableConversation, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // link to begin the download
  return downloadToBrowser(blob, `conversation-${conversation.id}.json`);
}

export function downloadDAllJson(): boolean {
  // conversations and
  const payload: { conversations: Partial<DConversation>[], models: { sources: DModelSource[] } } = {
    conversations: useChatStore.getState().conversations.map(cleanConversationForExport),
    models: { sources: useModelsStore.getState().sources },
  };
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });

  // link to begin the download
  const isoDate = new Date().toISOString().replace(/:/g, '-');
  return downloadToBrowser(blob, `conversations-${isoDate}.json`);
}

function cleanConversationForExport(_conversation: DConversation): Partial<DConversation> {
  // remove fields from the export
  const { abortController, ephemerals, ...conversation } = _conversation;
  return conversation;
}

function downloadToBrowser(blob: Blob, fileName: string): boolean {
  if (typeof window === 'undefined') return false;
  const tempUrl = URL.createObjectURL(blob);
  const tempLink = document.createElement('a');
  tempLink.href = tempUrl;
  tempLink.download = fileName;
  tempLink.style.display = 'none';
  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.removeChild(tempLink);
  URL.revokeObjectURL(tempUrl);
  return true;
}


/**
 * Restore a conversation from a JSON string
 */
export function restoreDConversationFromJson(json: string): DConversation | null {
  const restored: Partial<DConversation> = JSON.parse(json);
  if (restored && restored.id && restored.messages) {
    return {
      id: restored.id,
      messages: restored.messages,
      systemPurposeId: restored.systemPurposeId || defaultSystemPurposeId,
      ...(restored.userTitle && { userTitle: restored.userTitle }),
      ...(restored.autoTitle && { autoTitle: restored.autoTitle }),
      tokenCount: restored.tokenCount || 0,
      created: restored.created || Date.now(),
      updated: restored.updated || Date.now(),
      // these fields are not exported
      abortController: null,
      ephemerals: [],
    } satisfies DConversation;
  }
  return null;
}