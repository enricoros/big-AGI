import { fileOpen, fileSave, FileWithHandle } from 'browser-fs-access';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { Brand } from '~/common/app.config';
import { DataAtRestV1 } from '~/common/stores/chat/chats.converters';
import { Release } from '~/common/app.release';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle, DConversation, excludeSystemMessages } from '~/common/stores/chat/chat.conversation';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { prettyShortChatModelName } from '~/common/util/dMessageUtils';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';
import { useChatStore } from '~/common/stores/chat/store-chats';
import { useFolderStore } from '~/common/stores/folders/store-chat-folders';

import type { ImportedOutcome } from './ImportOutcomeModal';


export function tradeFileVariant() {
  return `${capitalizeFirstLetter(Release.TenantSlug)}`
}


/// IMPORT ///

/**
 * Load conversations from the given Files (we don't need/use the handle here, as no LiveFile is involved in the import)
 * @param files The files to import, if null the user may have cancelled the request
 * @param preventClash If true, the importer will not overwrite existing conversations with the same ID
 * @param restoreModelServices If true, model services (incl. API keys) found in backup files are restored, add-only - keep OFF for casual surfaces (drag-drop), ON only for deliberate restore (Import dialog)
 */
export async function importConversationsFromFilesAtRest(files: File[] | null, preventClash: boolean = false, restoreModelServices: boolean = false): Promise<ImportedOutcome> {
  const outcome: ImportedOutcome = { conversations: [], modelServices: [], activateConversationId: null };

  // user cancelled
  if (!files)
    return outcome;

  // unroll files to conversations
  for (const file of files) {
    const fileName = file.name || 'unknown file';
    try {
      const fileString = await file.text();
      const fileObject = JSON.parse(fileString);
      loadConversationsFromAtRestV1(fileName, fileObject, outcome);
    } catch (error: any) {
      outcome.conversations.push({
        success: false,
        fileName,
        error: `Issue loading file: ${error?.message || error?.toString() || 'unknown error'}`,
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

  // import model services (incl. API keys): explicit opt-in only, and add-only - never overwrites existing services
  if (restoreModelServices && outcome.modelServices.length)
    outcome.servicesOutcome = llmsStoreActions().importServicesAppend(outcome.modelServices);

  return outcome;
}

/**
 * Show a file picker dialog, then return the selected files
 * - this chains well with `importConversationsFromFilesAtRest`
 */
export async function openConversationsAtRestPicker(): Promise<FileWithHandle[] | null> {
  try {
    return await fileOpen({
      description: `${Brand.Title.Base} JSON Conversations`,
      mimeTypes: ['application/json', 'application/big-agi'],
      multiple: true,
    });
  } catch (error) {
    // User closed the dialog
    return null;
  }
}


/**
 * Restores all conversations in a JSON
 *  - supports both  DataAtRestV1.RestAllJsonV1B, and DataAtRestV1.RestChatJsonV1 files
 */
function loadConversationsFromAtRestV1(fileName: string, obj: any, outcome: ImportedOutcome) {
  // heuristics
  const hasConversations = obj.hasOwnProperty('conversations');
  const hasMessages = obj.hasOwnProperty('messages');

  switch (true) {

    // Heuristic (backup): DataAtRestV1.RestAllJsonV1B
    case hasConversations && !hasMessages:
      const { conversations, folders, models } = obj as DataAtRestV1.RestAllJsonV1B;
      for (const conversation of conversations)
        loadSingleChatFromAtRestV1(fileName, conversation, outcome);

      // in ExportedAllJsonV1b+, folders weren't there before
      if (folders?.folders) {
        const dFolders = DataAtRestV1.recreateFolders(folders.folders);
        if (dFolders.length)
          useFolderStore.getState().importFoldersAppend(dFolders, folders.enableFolders);
      }

      // collect model services - light shape check only, the applier (importServicesAppend) validates the vendor and skips duplicates
      if (models?.sources && Array.isArray(models.sources))
        for (const service of models.sources)
          if (service && typeof service === 'object' && service.id && service.vId)
            outcome.modelServices.push(service);
      break;

    // Heuristic (single):
    case hasMessages && !hasConversations:
      const conversation = obj as DataAtRestV1.RestChatJsonV1;
      loadSingleChatFromAtRestV1(fileName, conversation, outcome);
      break;

    default:
      outcome.conversations.push({ success: false, fileName, error: `Invalid file: ${fileName}` });
      break;

  }
}

function loadSingleChatFromAtRestV1(fileName: string, part: DataAtRestV1.RestChatJsonV1, outcome: ImportedOutcome) {
  const restored = DataAtRestV1.recreateConversation(part);
  if (!restored)
    outcome.conversations.push({ success: false, fileName, error: `Invalid conversation: ${part.id}` });
  else
    outcome.conversations.push({ success: true, fileName, conversation: restored });
}


/// EXPORT ///

/**
 * Download all conversations as a JSON file, for backup and future restore
 * @returns the number of conversations saved and the exact file size, for UI confirmation
 * @throws {DOMException} AbortError if the user closes the save dialog
 * @throws {Error} if there are no conversations to save, or the file could not be saved
 */
export async function downloadAllJsonV1B(): Promise<{ conversationCount: number; sizeBytes: number }> {
  // conversations and
  const { folders, enableFolders } = useFolderStore.getState();
  const conversations = useChatStore.getState().conversations;

  // never write an empty backup - the store may still be hydrating, or there is nothing to save
  if (!conversations.length)
    throw new Error('No conversations to backup. If you have chats, wait for the app to finish loading and retry.');

  const payload = DataAtRestV1.formatAllToJsonV1B(
    conversations,
    llmsStoreState().sources,
    folders, enableFolders,
  );
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });

  // save file - let errors (including AbortError on cancel) reach the caller, so the UI never fakes success
  await fileSave(blob, {
    fileName: `backup_chats_${window?.location?.hostname || 'all'}_${payload.conversations.length}_${prettyTimestampForFilenames(false)}.agi.json`,
    // mimeTypes: ['application/json', 'application/big-agi'],
    extensions: ['.json'],
  });

  return { conversationCount: payload.conversations.length, sizeBytes: blob.size };
}

/**
 * Download a conversation as a JSON file, for backup and future restore
 * @throws {DOMException} AbortError if the user closes the save dialog
 * @throws {Error} if the file could not be saved
 */
export async function downloadSingleChat(conversation: DConversation, format: 'json' | 'markdown') {

  let blob: Blob;
  let extension: string;

  if (format == 'json') {

    // remove fields (abortController, etc.) from the export
    const exportableConversation = DataAtRestV1.formatChatToJsonV1(conversation);
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

  // save file - let errors (including AbortError on cancel) reach the caller, so the UI never fakes success
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
  return mdTitle + excludeSystemMessages(conversation.messages, !hideSystemMessage).map(message => {
    let senderName: string = message.role === 'user' ? 'You' : 'Bot'; // from role
    let text = messageFragmentsReduceText(message.fragments);
    switch (message.role) {
      case 'system':
        // senderName = '✨ System message';
        senderName = 'System message';
        text = `*${text}*`;
        break;
      case 'assistant':
        const purpose = message.purposeId || conversation.systemPurposeId || null;
        senderName = `${purpose || 'Assistant'} · *${prettyShortChatModelName(message.generator?.name || '')}*`.trim();
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
