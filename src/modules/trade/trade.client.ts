import { fileSave } from 'browser-fs-access';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { Brand } from '~/common/app.config';
import { DataAtRestV1 } from '~/common/stores/chat/chats.converters';
import { Release } from '~/common/app.release';
import { capitalizeFirstLetter } from '~/common/util/textUtils';
import { idbFlushWrites } from '~/common/util/idbUtils';
import { conversationTitle, DConversation, excludeSystemMessages } from '~/common/stores/chat/chat.conversation';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { prettyShortChatModelName } from '~/common/util/dMessageUtils';
import { prettyTimestampForFilenames } from '~/common/util/timeUtils';
import { useChatStore } from '~/common/stores/chat/store-chats';

import type { TradeAdapter } from './trade.types';
import { tradeChatsAdapter } from './adapters/trade.chats';
import { tradeFoldersAdapter } from './adapters/trade.folders';
import { tradeLegacyServicesAdapter } from './adapters/trade.services';
import { tradeSettingsAdapters } from './adapters/trade.settings';


export function tradeFileVariant() {
  return `${capitalizeFirstLetter(Release.TenantSlug)}`
}


/// ADAPTERS ///

/**
 * The kinds of data this build can export and import.
 *
 * A function, not a constant: it reads the stores, so it is called when a trade dialog opens, never
 * while the app loads. A build that stores its data differently returns its own.
 */
export function tradeAdapters(): TradeAdapter[] {
  return [
    {
      ...tradeChatsAdapter({
        schema: 'app-chats.v4',
        // what the store persists: no incognito, no empty conversations
        list: () => useChatStore.getState().conversations.filter(c => !c._isIncognito && (c.messages?.length || c.userTitle || c.autoTitle)),
        fromJson: (json) => DataAtRestV1.recreateConversation(json as DataAtRestV1.RestChatJsonV1),
        import: (conversation) => useChatStore.getState().importConversation(conversation, false),
        saved: idbFlushWrites,
      }),
      // the chats load from disk after the app starts: an export before that would be an empty one
      // (no 'persist' where the browser has no IndexedDB: the chats then live in memory only)
      ...(useChatStore.persist?.hasHydrated() === false && { unavailable: 'Conversations are still loading' }),
    },
    tradeFoldersAdapter(),
    ...tradeSettingsAdapters(),
    tradeLegacyServicesAdapter(),
  ];
}


/// EXPORT ///

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
