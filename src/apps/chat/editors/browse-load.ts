import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { createTextPart } from '~/common/stores/chat/chat.message';


export const runBrowseGetPageUpdatingState = async (cHandler: ConversationHandler, url?: string) => {
  if (!url) {
    cHandler.messageAppendAssistant('Issue: no URL provided.', 'issue');
    return false;
  }

  // noinspection HttpUrlsUsage
  const shortUrl = url.replace('https://www.', '').replace('https://', '').replace('http://', '').replace('www.', '');
  const assistantMessageId = cHandler.messageAppendAssistantPlaceholder(
    `Loading page at ${shortUrl}...`,
    { originLLM: 'web' },
  );

  try {

    const page = await callBrowseFetchPage(url);

    const pageContent = page.content.markdown || page.content.text || page.content.html || 'Issue: page load did not produce an answer: no text found';
    cHandler.messageEdit(assistantMessageId, {
      content: [createTextPart(pageContent)],
      pendingIncomplete: undefined, pendingPlaceholderText: undefined,
    }, true);

    return true;
  } catch (error: any) {
    console.error(error);
    const pageError = 'Issue: browse did not produce an answer (error: ' + (error?.message || error?.toString() || 'unknown') + ').';
    cHandler.messageEdit(assistantMessageId, {
      content: [createTextPart(pageError)],
      pendingIncomplete: undefined, pendingPlaceholderText: undefined,
    }, true);
    return false;
  }
};