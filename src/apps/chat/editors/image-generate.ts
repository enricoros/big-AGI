import type { DBlobAssetId } from '~/modules/dblobs/dblobs.types';
import { addDBImageAsset, gcDBImageAssets } from '~/modules/dblobs/dblobs.images';
import { getActiveTextToImageProviderOrThrow, t2iGenerateImagesOrThrow } from '~/modules/t2i/t2i.client';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { createDMessageDataRefDBlob, createImageContentFragment } from '~/common/stores/chat/chat.message';
import { useChatStore } from '~/common/stores/chat/store-chats';


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

      // add the image to the DB
      const dblobAssetId = await addDBImageAsset('global', 'app-chat', {
        label: imageText, // 'Image: ' + _i.altText
        data: {
          mimeType: _i.mimeType as any, /* we assume the mime is supported */
          base64: _i.base64Data,
        },
        origin: {
          ot: 'generated',
          source: 'ai-text-to-image',
          generatorName: _i.generatorName,
          prompt: _i.altText,
          parameters: _i.parameters,
          generatedAt: _i.generatedAt,
        },
        metadata: {
          width: _i.width || 0,
          height: _i.height || 0,
          // description: '',
        },
      });

      // Create and add an Image Content Fragment
      const imageContentFragment = createImageContentFragment(
        createDMessageDataRefDBlob(dblobAssetId, _i.mimeType, _i.base64Data.length),
        _i.altText,
        _i.width, _i.height,
      );
      cHandler.messageAppendContentFragment(assistantMessageId, imageContentFragment, true, true);
    }
    return true;
  } catch (error: any) {

    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    cHandler.messageAppendErrorContentFragment(assistantMessageId, `Issue: Sorry, I couldn't create an image for you. ${errorMessage}`, true, false);

    return false;
  }
}

/**
 * Garbage collect unreferenced dblobs in global chats
 */
export async function gcChatImageAssets() {

  // find all the dblob references in all chats
  const chatsAssetIDs: Set<DBlobAssetId> = new Set();
  const chatStore = useChatStore.getState();
  for (const chat of chatStore.conversations) {
    for (const message of chat.messages) {
      for (const fragment of message.fragments) {
        if (fragment.ft !== 'content' && fragment.ft !== 'attachment')
          continue;
        if (fragment.part.pt !== 'image_ref')
          continue;
        if (fragment.part.dataRef.reftype !== 'dblob')
          continue;
        chatsAssetIDs.add(fragment.part.dataRef.dblobAssetId);
      }
    }
  }

  // sanity check: if no blobs are referenced, do nothing; in case we have a state bug and we don't wipe the db
  if (!chatsAssetIDs.size)
    return;

  // perform the GC (set to array)
  await gcDBImageAssets('global', 'app-chat', Array.from(chatsAssetIDs));
}
