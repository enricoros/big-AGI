import { fileSave } from 'browser-fs-access';

import { defaultSystemPurposeId } from '../../../data';

import { DModelSource } from '~/modules/llms/llm.types';
import { useModelsStore } from '~/modules/llms/store-llms';

import { DConversation, useChatStore } from '~/common/state/store-chats';
import { ImportedOutcome } from './ImportOutcomeModal';


/**
 * Download a conversation as a JSON file, for backup and future restore
 * @throws {Error} if the user closes the dialog, or file could not be saved
 */
export async function downloadDConversationJson(conversation: DConversation) {
  // remove fields from the export
  const exportableConversation: ExportedConversationJsonV1 = cleanConversationForExport(conversation);
  const json = JSON.stringify(exportableConversation, null, 2);
  const blob = new Blob([json], { type: 'application/json' });

  // link to begin the download
  await fileSave(blob, { fileName: `conversation-${conversation.id}.json`, extensions: ['.json'] });
}

/**
 * Download all conversations as a JSON file, for backup and future restore
 * @throws {Error} if the user closes the dialog, or file could not be saved
 */
export async function downloadDAllJson() {
  // conversations and
  const payload: ExportedAllJsonV1 = {
    conversations: useChatStore.getState().conversations.map(cleanConversationForExport),
    models: { sources: useModelsStore.getState().sources },
  };
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });

  // link to begin the download
  const isoDate = new Date().toISOString().replace(/:/g, '-');
  await fileSave(blob, { fileName: `conversations-${isoDate}.json`, extensions: ['.json'] });
}

function cleanConversationForExport(_conversation: DConversation): Partial<DConversation> {
  // remove fields from the export
  const { abortController, ephemerals, ...conversation } = _conversation;
  return conversation;
}

// Restores a conversation from a JSON string
function restoreDConversationFromJson(fileName: string, part: Partial<DConversation>, outcome: ImportedOutcome) {
  if (!part || !part.id || !part.messages) {
    outcome.conversations.push({ success: false, fileName, error: `Invalid conversation: ${part.id}` });
    return;
  }
  const restored: DConversation = {
    id: part.id,
    messages: part.messages,
    systemPurposeId: part.systemPurposeId || defaultSystemPurposeId,
    ...(part.userTitle && { userTitle: part.userTitle }),
    ...(part.autoTitle && { autoTitle: part.autoTitle }),
    tokenCount: part.tokenCount || 0,
    created: part.created || Date.now(),
    updated: part.updated || Date.now(),
    // add these back - these fields are not exported
    abortController: null,
    ephemerals: [],
  };
  outcome.conversations.push({ success: true, fileName, conversation: restored });
}

// Restores a list of conversations by downloadDAllJson
export function restoreDConversationsFromJSON(fileName: string, obj: any, outcome: ImportedOutcome) {
  // heuristics
  const hasConversations = obj.hasOwnProperty('conversations');
  const hasMessages = obj.hasOwnProperty('messages');

  // parse ExportedAllJsonV1
  if (hasConversations && !hasMessages) {
    const payload = obj as ExportedAllJsonV1;
    for (let conversation of payload.conversations)
      restoreDConversationFromJson(fileName, conversation, outcome);
  }
  // parse ExportedConversationJsonV1
  else if (hasMessages && !hasConversations) {
    restoreDConversationFromJson(fileName, obj as ExportedConversationJsonV1, outcome);
  }
  // invalid
  else {
    outcome.conversations.push({ success: false, fileName, error: `Invalid file: ${fileName}` });
  }
}


/// do not change these - consider people's backups

type ExportedConversationJsonV1 = Partial<DConversation>;

type ExportedAllJsonV1 = {
  conversations: ExportedConversationJsonV1[];
  models: { sources: DModelSource[] };
}