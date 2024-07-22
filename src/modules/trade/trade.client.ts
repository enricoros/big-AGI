import { fileOpen, fileSave, FileWithHandle } from 'browser-fs-access';

import { defaultSystemPurposeId, SystemPurposeId, SystemPurposes } from '../../data';

import { useModelsStore } from '~/modules/llms/store-llms';

import { Brand } from '~/common/app.config';
import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle, DConversation } from '~/common/stores/chat/chat.conversation';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { prettyBaseModel } from '~/common/util/modelUtils';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';
import { useChatStore } from '~/common/stores/chat/store-chats';

import type { ImportedOutcome } from './ImportOutcomeModal';
import { convertDConversation_V3_V4, convertDMessageV3_to_V4, ExportedAllJsonV1B, ExportedChatJsonV1, ExportedFolderJsonV1 } from './trade.types';


/// IMPORT ///

/**
 * Open a file dialog and load all conversations from the selected JSON files
 */
export async function openAndLoadConversations(preventClash: boolean = false): Promise<ImportedOutcome | null> {
  const outcome: ImportedOutcome = { conversations: [], activateConversationId: null };

  let blobs: FileWithHandle[];
  try {
    blobs = await fileOpen({
      description: `${Brand.Title.Base} JSON Conversations`,
      mimeTypes: ['application/json', 'application/big-agi'],
      multiple: true,
    });
  } catch (error) {
    // User closed the dialog
    return null;
  }

  // unroll files to conversations
  for (const blob of blobs) {
    const fileName = blob.name || 'unknown file';
    try {
      const fileString = await blob.text();
      const fileObject = JSON.parse(fileString);
      loadAllConversationsFromJson(fileName, fileObject, outcome);
    } catch (error: any) {
      outcome.conversations.push({
        success: false,
        fileName,
        error: `Invalid file: ${error?.message || error?.toString() || 'unknown error'}`,
      });
    }
  }

  // import conversations
  for (const cOutcome of [...outcome.conversations].reverse()) {
    if (!cOutcome.success)
      continue;
    cOutcome.importedConversationId = useChatStore.getState().importConversation(cOutcome.conversation, preventClash);
    // the last successfully imported is the one to activate
    if (cOutcome.importedConversationId)
      outcome.activateConversationId = cOutcome.importedConversationId;
  }

  return outcome;
}


/**
 * Restores all conversations in a JSON
 *  - supports both ExportedConversationJsonV1, and ExportedAllJsonV1 files
 */
function loadAllConversationsFromJson(fileName: string, obj: any, outcome: ImportedOutcome) {
  // heuristics
  const hasConversations = obj.hasOwnProperty('conversations');
  const hasMessages = obj.hasOwnProperty('messages');

  // parse ExportedAllJsonV1
  if (hasConversations && !hasMessages) {
    const { conversations, folders } = obj as ExportedAllJsonV1B;
    for (const conversation of conversations)
      pushOutcomeFromJsonV1(fileName, conversation, outcome);
    // in ExportedAllJsonV1b+, folders weren't there before
    if (folders?.folders) {
      const dFolders = folders.folders.map(createFolderFromJsonV1).filter(Boolean) as DFolder[];
      useFolderStore.getState().importFoldersAppend(dFolders, folders.enableFolders);
    }
  }
  // parse ExportedConversationJsonV1
  else if (hasMessages && !hasConversations) {
    pushOutcomeFromJsonV1(fileName, obj as ExportedChatJsonV1, outcome);
  }
  // invalid
  else {
    outcome.conversations.push({ success: false, fileName, error: `Invalid file: ${fileName}` });
  }
}

function pushOutcomeFromJsonV1(fileName: string, part: ExportedChatJsonV1, outcome: ImportedOutcome) {
  const restored = createDConversationFromJsonV1(part);
  if (!restored)
    outcome.conversations.push({ success: false, fileName, error: `Invalid conversation: ${part.id}` });
  else
    outcome.conversations.push({ success: true, fileName, conversation: restored });
}


// NOTE: the tokenCount was removed while still in the JsonV1 format, so here we add it back, for backwards compat
export function createDConversationFromJsonV1(part: ExportedChatJsonV1 & { tokenCount?: number }) {
  if (!part || !part.id || !part.messages) {
    console.warn('createConversationFromJsonV1: invalid conversation json', part);
    return null;
  }
  return convertDConversation_V3_V4({
    id: part.id,
    messages: part.messages.map(convertDMessageV3_to_V4),
    systemPurposeId: (part.systemPurposeId as any) || defaultSystemPurposeId,
    ...(part.userTitle && { userTitle: part.userTitle }),
    ...(part.autoTitle && { autoTitle: part.autoTitle }),
    tokenCount: part.tokenCount || 0,
    created: part.created || Date.now(),
    updated: part.updated || Date.now(),
    // add these back - these fields are not exported
    _abortController: null,
  });
}

function createFolderFromJsonV1(part: ExportedFolderJsonV1) {
  if (!part || !part.id || !part.title || !part.conversationIds) {
    console.warn('createFolderFromJsonV1: invalid folder json', part);
    return null;
  }
  const restored: DFolder = {
    id: part.id,
    title: part.title,
    conversationIds: part.conversationIds,
    color: part.color,
  };
  return restored;
}


/// EXPORT ///

/**
 * Download all conversations as a JSON file, for backup and future restore
 * @throws {Error} if the user closes the dialog, or file could not be saved
 */
export async function downloadAllConversationsJson() {
  // conversations and
  const { folders, enableFolders } = useFolderStore.getState();
  const payload: ExportedAllJsonV1B = {
    conversations: useChatStore.getState().conversations.map(conversationToJsonV1),
    folders: { folders, enableFolders },
    models: { sources: useModelsStore.getState().sources },
  };
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });

  // save file
  await fileSave(blob, {
    fileName: `backup_chats_${window?.location?.hostname || 'all'}_${payload.conversations.length}_${prettyTimestampForFilenames(false)}.agi.json`,
    // mimeTypes: ['application/json', 'application/big-agi'],
    extensions: ['.json'],
  });
}

/**
 * Download a conversation as a JSON file, for backup and future restore
 * @throws {Error} if the user closes the dialog, or file could not be saved
 */
export async function downloadConversation(conversation: DConversation, format: 'json' | 'markdown') {

  let blob: Blob;
  let extension: string;

  if (format == 'json') {
    // remove fields (abortController, etc.) from the export
    const exportableConversation: ExportedChatJsonV1 = conversationToJsonV1(conversation);
    const json = JSON.stringify(exportableConversation, null, 2);
    blob = new Blob([json], { type: 'application/json' });
    extension = '.json';
  } else if (format == 'markdown') {
    const exportableMarkdown = conversationToMarkdown(conversation, false, true, (name: string) => `## ${name} ##`);
    blob = new Blob([exportableMarkdown], { type: 'text/markdown' });
    extension = '.md';
  } else {
    throw new Error(`Invalid download format: ${format}`);
  }

  // const fileConvId = conversation.id.slice(0, 8);
  const fileTitle = conversationTitle(conversation).replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'untitled';

  // save file
  await fileSave(blob, {
    fileName: `conversation_${fileTitle}_${prettyTimestampForFilenames(false)}.agi${extension}`,
    extensions: [extension],
  });
}

/**
 * Primitive rendering of a Conversation to Markdown
 */
export function conversationToMarkdown(conversation: DConversation, hideSystemMessage: boolean, exportTitle: boolean, senderWrap?: (text: string) => string): string {
  const mdTitle = exportTitle
    ? `# ${capitalizeFirstLetter(conversationTitle(conversation, Brand.Title.Common + ' Chat'))}\nA ${Brand.Title.Common} conversation, updated on ${(new Date(conversation.updated || conversation.created)).toLocaleString()}.\n\n`
    : '';
  return mdTitle + conversation.messages.filter(message => !hideSystemMessage || message.role !== 'system').map(message => {
    let senderName: string = message.role === 'user' ? 'You' : 'Bot'; // from role
    let text = messageFragmentsReduceText(message.fragments);
    switch (message.role) {
      case 'system':
        senderName = '✨ System message';
        text = '<img src="https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp" width="48" height="48" alt="meme"/>\n\n' + '*' + text + '*';
        break;
      case 'assistant':
        const purpose = message.purposeId || conversation.systemPurposeId || null;
        senderName = `${purpose || 'Assistant'} · *${prettyBaseModel(message.originLLM || '')}*`.trim();
        if (purpose && purpose in SystemPurposes)
          senderName = `${SystemPurposes[purpose as SystemPurposeId]?.symbol || ''} ${senderName}`.trim();
        break;
      case 'user':
        senderName = '👤 You';
        break;
    }
    return (senderWrap?.(senderName) || `### ${senderName}`) + `\n\n${text}\n\n`;
  }).join('---\n\n');

}

export function conversationToJsonV1(_conversation: DConversation): ExportedChatJsonV1 {
  return {
    id: _conversation.id,
    messages: _conversation.messages,
    systemPurposeId: _conversation.systemPurposeId,
    userTitle: _conversation.userTitle,
    autoTitle: _conversation.autoTitle,
    created: _conversation.created,
    updated: _conversation.updated,
  };
}
