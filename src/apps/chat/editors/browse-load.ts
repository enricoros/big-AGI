import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { DMessage, useChatStore } from '~/common/state/store-chats';

import { createAssistantTypingMessage } from './editors';


export const runBrowseUpdatingState = async (conversationId: string, url: string) => {

  const { editMessage } = useChatStore.getState();

  // create a blank and 'typing' message for the assistant - to be filled when we're done
  // const assistantModelStr = 'react-' + assistantModelId.slice(4, 7); // HACK: this is used to change the Avatar animation
  // noinspection HttpUrlsUsage
  const shortUrl = url.replace('https://www.', '').replace('https://', '').replace('http://', '').replace('www.', '');
  const assistantMessageId = createAssistantTypingMessage(conversationId, 'web', undefined, `Loading page at ${shortUrl}...`);
  const updateAssistantMessage = (update: Partial<DMessage>) => editMessage(conversationId, assistantMessageId, update, false);

  try {

    const page = await callBrowseFetchPage(url);
    if (!page.content) {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error('No text found.');
    }
    updateAssistantMessage({
      text: page.content,
      typing: false,
    });

  } catch (error: any) {
    console.error(error);
    updateAssistantMessage({
      text: 'Issue: browse did not produce an answer (error: ' + (error?.message || error?.toString() || 'unknown') + ').',
      typing: false,
    });
  }
};