import { addDBlobItem } from '~/modules/dblobs/dblobs.db';
import { createDBlobImageItem } from '~/modules/dblobs/dblobs.types';

import { getActiveTextToImageProviderOrThrow, t2iGenerateImagesOrThrow } from '~/modules/t2i/t2i.client';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { createDMessageDataRefDBlob } from '~/common/stores/chat/chat.message';


/**
 * Text to image, appended as an 'assistant' message
 */
export async function runImageGenerationUpdatingState(cHandler: ConversationHandler, imageText?: string) {
  if (!imageText) {
    cHandler.messageAppendAssistant('Issue: no image description provided.', 'issue');
    return false;
  }

  // Acquire the active TextToImageProvider
  let t2iProvider: TextToImageProvider | undefined = undefined;
  try {
    t2iProvider = getActiveTextToImageProviderOrThrow();
  } catch (error: any) {
    cHandler.messageAppendAssistant(`[Issue] Sorry, I can't generate images right now. ${error?.message || error?.toString() || 'Unknown error'}.`, 'issue');
    return 'err-t2i-unconfigured';
  }

  // if the imageText ends with " xN" or " [N]" (where N is a number), then we'll generate N images
  const match = imageText.match(/\sx(\d+)$|\s\[(\d+)]$/);
  const repeat = match ? parseInt(match[1] || match[2], 10) : 1;
  if (repeat > 1)
    imageText = imageText.replace(/x(\d+)$|\[(\d+)]$/, '').trim(); // Remove the "xN" or "[N]" part from the imageText

  const assistantMessageId = cHandler.messageAppendAssistantPlaceholder(
    `Give me ${t2iProvider.vendor === 'openai' ? 'a dozen' : 'a few'} seconds while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'}...`,
    { originLLM: t2iProvider.painter },
  );

  try {
    const images = await t2iGenerateImagesOrThrow(t2iProvider, imageText, repeat);
    for (const _i of images) {

      // Create DBlob image item
      const dblobImageItem = createDBlobImageItem(
        'Image: ' + _i.altText,
        {
          mimeType: _i.mimeType as any, /* we assume the mime is supported */
          base64: _i.base64Data,
        },
        {
          origin: 'generated',
          source: 'ai-text-to-image',
          generatorName: _i.generatorName,
          prompt: _i.altText,
          parameters: _i.parameters,
          generatedAt: _i.generatedAt,
        },
        {
          width: _i.width || 0,
          height: _i.height || 0,
          // description: '',
        },
      );

      // Add to DBlobs database
      const dblobId = await addDBlobItem(dblobImageItem, 'global', 'app-chat');

      // Create a data reference for the image from the message
      const imagePartDataRef = createDMessageDataRefDBlob(dblobId, _i.mimeType, _i.base64Data.length);

      // Append the image to the chat
      cHandler.messageAppendImageContentFragment(assistantMessageId, imagePartDataRef, _i.altText, _i.width, _i.height, true, true);
    }
    return true;
  } catch (error: any) {

    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    cHandler.messageAppendErrorContentFragment(assistantMessageId, `Issue: Sorry, I couldn't create an image for you. ${errorMessage}`, true, false);

    return false;
  }
}