import { getActiveTextToImageProviderOrThrow, t2iGenerateImageOrThrow } from '~/modules/t2i/t2i.client';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import type { TextToImageProvider } from '~/common/components/useCapabilities';


/**
 * Text to image, appended as an 'assistant' message
 */
export async function runImageGenerationUpdatingState(cHandler: ConversationHandler, imageText?: string) {
  if (!imageText) {
    cHandler.messageAppendAssistant('Issue: no image description provided.', undefined, 'issue', false);
    return false;
  }

  // Acquire the active TextToImageProvider
  let t2iProvider: TextToImageProvider | undefined = undefined;
  try {
    t2iProvider = getActiveTextToImageProviderOrThrow();
  } catch (error: any) {
    cHandler.messageAppendAssistant(`[Issue] Sorry, I can't generate images right now. ${error?.message || error?.toString() || 'Unknown error'}.`, undefined, 'issue', false);
    return 'err-t2i-unconfigured';
  }

  // if the imageText ends with " xN" or " [N]" (where N is a number), then we'll generate N images
  const match = imageText.match(/\sx(\d+)$|\s\[(\d+)]$/);
  const repeat = match ? parseInt(match[1] || match[2], 10) : 1;
  if (repeat > 1)
    imageText = imageText.replace(/x(\d+)$|\[(\d+)]$/, '').trim(); // Remove the "xN" or "[N]" part from the imageText

  const assistantMessageId = cHandler.messageAppendAssistant(
    `Give me ${t2iProvider.vendor === 'openai' ? 'a dozen' : 'a few'} seconds while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'}...`,
    undefined, t2iProvider.painter, true,
  );

  try {
    const imageUrls = await t2iGenerateImageOrThrow(t2iProvider, imageText, repeat);
    cHandler.messageEdit(assistantMessageId, { text: imageUrls.join('\n'), typing: false }, true);
    return true;
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    cHandler.messageEdit(assistantMessageId, { text: `[Issue] Sorry, I couldn't create an image for you. ${errorMessage}`, typing: false }, false);
    return false;
  }
}