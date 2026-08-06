import { getActiveTextToImageProviderOrThrow, t2iGenerateImageContentFragments } from '~/modules/t2i/t2i.client';

import type { AixParts_InlineImagePart } from '~/modules/aix/server/api/aix.wiretypes';
import { aixConvertImageRefToInlineImageOrThrow, aixConvertZyncImageAssetRefToInlineImageOrThrow } from '~/modules/aix/client/aix.client.chatGenerateRequest';

import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import type { Immutable } from '~/common/types/immutable.types';
import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { DMessageFragment, createErrorContentFragment, isContentOrAttachmentFragment, isImageRefPart, isZyncAssetImageReferencePartWithLegacyDBlob } from '~/common/stores/chat/chat.fragments';


// NOTE: also see src/common/stores/chat/chat.gc.ts, which has cleanup code for images create here


/**
 * Text to image, appended as an 'assistant' message
 */
export async function runImageGenerationUpdatingState(cHandler: ConversationHandler, imageText: string, imageFragments?: Immutable<DMessageFragment[]>) {
  if (!imageText) {
    cHandler.messageAppendAssistantText('Issue: no image description provided.', 'issue');
    return false;
  }

  // Acquire the active TextToImageProvider
  let t2iProvider: TextToImageProvider | undefined = undefined;
  try {
    t2iProvider = getActiveTextToImageProviderOrThrow();
  } catch (error: any) {
    cHandler.messageAppendAssistantText(`[Issue] Sorry, I can't generate images right now. ${error?.message || error?.toString() || 'Unknown error'}.`, 'issue');
    return 'err-t2i-unconfigured';
  }

  // if the imageText ends with " xN" or " [N]" (where N is a number), then we'll generate N images
  const match = imageText.match(/\sx(\d+)$|\s\[(\d+)]$/);
  const repeat = match ? parseInt(match[1] || match[2], 10) : 1;
  if (repeat > 1)
    imageText = imageText.replace(/x(\d+)$|\[(\d+)]$/, '').trim(); // Remove the "xN" or "[N]" part from the imageText

  const { assistantMessageId, placeholderFragmentId } = cHandler.messageAppendAssistantPlaceholder(
    `Give me ${t2iProvider.vendor === 'openai' ? 'a minute' : 'a few seconds'} while I draw ${imageText?.length > 20 ? 'that' : '"' + imageText + '"'} with ${t2iProvider.painter}...`,
    { generator: { mgt: 'named', name: t2iProvider.painter } },
  );

  // edit-generation: ready the images payload
  const aixInlineImageParts: AixParts_InlineImagePart[] = [];
  if (imageFragments?.length) {
    for (const fragment of imageFragments) {
      if (!isContentOrAttachmentFragment(fragment)) continue;

      const part = fragment.part;
      const isZyncImageReference = isZyncAssetImageReferencePartWithLegacyDBlob(part);
      const isLegacyImageRef = isImageRefPart(part);

      if (!isZyncImageReference && !isLegacyImageRef) {
        console.log('[DEV] Invalid image fragment', { fragment });
        continue;
      }

      // dereference and ready for transmission - do not resize any input
      try {
        let aixImageInlinePart: AixParts_InlineImagePart | undefined;
        if (isZyncImageReference)
          aixImageInlinePart = await aixConvertZyncImageAssetRefToInlineImageOrThrow(part, false);
        else if (isLegacyImageRef)
          aixImageInlinePart = await aixConvertImageRefToInlineImageOrThrow(part, false);

        if (!aixImageInlinePart) {
          console.log('[DEV] Invalid image fragment', { fragment });
          continue;
        }
        aixInlineImageParts.push(aixImageInlinePart);
      } catch (error: any) {
        console.log('[DEV] Error converting image fragment', { fragment, error });
      }
    }
  }

  try {
    const imageContentFragments = await t2iGenerateImageContentFragments(t2iProvider, imageText, aixInlineImageParts, repeat, 'app-chat');

    // add the image content fragments to the message
    for (const imageContentFragment of imageContentFragments)
      cHandler.messageFragmentAppend(assistantMessageId, imageContentFragment, false, false);

    cHandler.messageFragmentDelete(assistantMessageId, placeholderFragmentId, true, true);

    return true;
  } catch (error: any) {

    const drawError = `Issue encountered while creating your image.\n${error?.message || error?.toString() || 'Unknown error'}.`;
    cHandler.messageFragmentReplace(assistantMessageId, placeholderFragmentId, createErrorContentFragment(drawError), true);

    return false;
  }
}

