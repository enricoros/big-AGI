import { fileSave } from 'browser-fs-access';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { Brand } from '~/common/app.config';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { conversationTitle, DConversation, excludeSystemMessages } from '~/common/stores/chat/chat.conversation';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { prettyShortChatModelName } from '~/common/util/dMessageUtils';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';

import { tradeAdapters } from './trade.adapters';
import { tradeFileName, tradeFileSave } from './trade.files';
import { tradeSectionsOfItem } from './trade.plan';


/// EXPORT ///

/**
 * Download a conversation: as an export file that an import reads back, with what the conversation needs,
 * or as Markdown to read.
 * @throws {DOMException} AbortError if the user closes the save dialog
 * @throws {Error} if the conversation is not one this device exports, or the file could not be saved
 */
export async function downloadSingleChat(conversation: DConversation, format: 'json' | 'markdown') {
  const fileTitle = conversationTitle(conversation).replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'untitled';
  const fileBase = `conversation_${fileTitle}_${prettyTimestampForFilenames(false)}`;

  // errors (AbortError on cancel included) reach the caller, so the UI never fakes success
  if (format === 'json') {
    await tradeFileSave(await tradeSectionsOfItem(tradeAdapters(), 'chat', conversation.id), fileBase);
    return;
  }

  const exportableMarkdown = conversationToMarkdown(conversation, false, true, (name: string) => `## ${name} ##`);
  await fileSave(new Blob([exportableMarkdown], { type: 'text/markdown' }), {
    fileName: tradeFileName(fileBase, '.md'),
    extensions: ['.md'],
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
