import { prodiaGenerateImage } from '~/modules/prodia/prodia.client';

import { useChatStore } from '~/common/state/store-chats';

import { createAssistantTypingMessage } from './editors';


/**
 * The main 'image generation' function - for now specialized to the 'imagine' command.
 */
export async function runImageGenerationUpdatingState(conversationId: string, imageText: string) {

  // if the imageText ends with " xN" or " [N]" (where N is a number), then we'll generate N images
  const match = imageText.match(/\sx(\d+)$|\s\[(\d+)]$/);
  const count = match ? parseInt(match[1] || match[2], 10) : 1;
  if (count > 1)
    imageText = imageText.replace(/x(\d+)$|\[(\d+)]$/, '').trim(); // Remove the "xN" or "[N]" part from the imageText

  // create a blank and 'typing' message for the assistant
  const assistantMessageId = createAssistantTypingMessage(conversationId, 'prodia', undefined,
    `Give me a few seconds while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'}...`);

  // reference the state editing functions
  const { editMessage } = useChatStore.getState();

  try {
    const imageUrls = await prodiaGenerateImage(count, imageText);

    // Concatenate all the resulting URLs and update the assistant message with these URLs
    const allImageUrls = imageUrls.join('\n');
    editMessage(conversationId, assistantMessageId, { text: allImageUrls, typing: false }, false);

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    editMessage(conversationId, assistantMessageId, { text: `Sorry, I couldn't create an image for you. ${errorMessage}`, typing: false }, false);
  }
}