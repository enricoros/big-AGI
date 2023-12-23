import { getActiveTextToImageProviderOrThrow, t2iGenerateImageOrThrow } from '~/modules/t2i/t2i.client';

import { useChatStore } from '~/common/state/store-chats';

import { createAssistantTypingMessage } from './editors';


/**
 * Text to image, appended as an 'assistant' message
 */
export async function runImageGenerationUpdatingState(conversationId: string, imageText: string) {

  // if the imageText ends with " xN" or " [N]" (where N is a number), then we'll generate N images
  const match = imageText.match(/\sx(\d+)$|\s\[(\d+)]$/);
  const count = match ? parseInt(match[1] || match[2], 10) : 1;
  if (count > 1)
    imageText = imageText.replace(/x(\d+)$|\[(\d+)]$/, '').trim(); // Remove the "xN" or "[N]" part from the imageText

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, '', undefined,
    `Give me a few seconds while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'}...`);

  // reference the state editing functions
  const { editMessage } = useChatStore.getState();

  try {

    const t2iProvider = getActiveTextToImageProviderOrThrow();
    editMessage(conversationId, assistantMessageId, { originLLM: t2iProvider.painter }, false);

    const imageUrls = await t2iGenerateImageOrThrow(t2iProvider, imageText, count);
    editMessage(conversationId, assistantMessageId, { text: imageUrls.join('\n'), typing: false }, true);

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    if (assistantMessageId)
      editMessage(conversationId, assistantMessageId, { text: `[Issue] Sorry, I couldn't create an image for you. ${errorMessage}`, typing: false }, false);
  }
}