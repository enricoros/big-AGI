import { getActiveTextToImageProviderOrThrow, t2iGenerateImageOrThrow } from '~/modules/t2i/t2i.client';

import { ConversationsManager } from '~/common/chats/ConversationsManager';
import { TextToImageProvider } from '~/common/components/useCapabilities';


/**
 * Text to image, appended as an 'assistant' message
 */
export async function runImageGenerationUpdatingState(conversationId: string, imageText: string) {
  const handler = ConversationsManager.getHandler(conversationId);

  // Acquire the active TextToImageProvider
  let t2iProvider: TextToImageProvider | undefined = undefined;
  try {
    t2iProvider = getActiveTextToImageProviderOrThrow();
  } catch (error: any) {
    const assistantErrorMessageId = handler.messageAppendAssistant(`[Issue] Sorry, I can't generate images right now. ${error?.message || error?.toString() || 'Unknown error'}.`, 'issue', undefined);
    handler.messageEdit(assistantErrorMessageId, { typing: false }, true);
    return;
  }

  // if the imageText ends with " xN" or " [N]" (where N is a number), then we'll generate N images
  const match = imageText.match(/\sx(\d+)$|\s\[(\d+)]$/);
  const repeat = match ? parseInt(match[1] || match[2], 10) : 1;
  if (repeat > 1)
    imageText = imageText.replace(/x(\d+)$|\[(\d+)]$/, '').trim(); // Remove the "xN" or "[N]" part from the imageText

  const assistantMessageId = handler.messageAppendAssistant(
    `Give me ${t2iProvider.vendor === 'openai' ? 'a dozen' : 'a few'} seconds while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'}...`,
    '', undefined,
  );
  handler.messageEdit(assistantMessageId, { originLLM: t2iProvider.painter }, false);

  try {
    const imageUrls = await t2iGenerateImageOrThrow(t2iProvider, imageText, repeat);
    handler.messageEdit(assistantMessageId, { text: imageUrls.join('\n'), typing: false }, true);
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    handler.messageEdit(assistantMessageId, { text: `[Issue] Sorry, I couldn't create an image for you. ${errorMessage}`, typing: false }, false);
  }
}