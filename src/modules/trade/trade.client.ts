import { fileSave } from 'browser-fs-access';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { Brand } from '~/common/app.config';
import { DataAtRestV1 } from '~/common/stores/chat/chats.converters';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle, DConversation, excludeSystemMessages } from '~/common/stores/chat/chat.conversation';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { prettyShortChatModelName } from '~/common/util/dMessageUtils';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';

import { tradeFileName } from './trade.files';


/// EXPORT ///

/**
 * Download a conversation as a JSON file, for backup and future restore
 * @throws {DOMException} AbortError if the user closes the save dialog
 * @throws {Error} if the file could not be saved
 */
export async function downloadSingleChat(conversation: DConversation, format: 'json' | 'markdown') {

  let blob: Blob;
  let extension: '.json' | '.md';

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
    fileName: tradeFileName(`conversation_${fileTitle}_${prettyTimestampForFilenames(false)}`, extension),
    extensions: [extension],
  });
}

/**
 * Primitive rendering of a Conversation to Markdown
 */
function conversationToMarkdown(conversation: DConversation, hideSystemMessage: boolean, exportTitle: boolean, senderWrap?: (text: string) => string): string {
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
