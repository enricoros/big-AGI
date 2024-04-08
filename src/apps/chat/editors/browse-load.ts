import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';


export const runBrowseGetPageUpdatingState = async (cHandler: ConversationHandler, url?: string) => {
  if (!url) {
    cHandler.messageAppendAssistant('Issue: no URL provided.', undefined, 'issue', false);
    return;
  }

  // noinspection HttpUrlsUsage
  const shortUrl = url.replace('https://www.', '').replace('https://', '').replace('http://', '').replace('www.', '');
  const assistantMessageId = cHandler.messageAppendAssistant(`Loading page at ${shortUrl}...`, undefined, 'web', true);

  try {
    const page = await callBrowseFetchPage(url);
    cHandler.messageEdit(assistantMessageId, { text: page.content || 'Issue: page load did not produce an answer: no text found', typing: false }, true);
  } catch (error: any) {
    console.error(error);
    cHandler.messageEdit(assistantMessageId, { text: 'Issue: browse did not produce an answer (error: ' + (error?.message || error?.toString() || 'unknown') + ').', typing: false }, true);
  }
};