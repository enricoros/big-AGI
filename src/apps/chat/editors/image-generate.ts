import type { DBlobAssetId } from '~/modules/dblobs/dblobs.types';
import { gcDBImageAssets } from '~/modules/dblobs/dblobs.images';
import { getActiveTextToImageProviderOrThrow, t2iGenerateImageContentFragments } from '~/modules/t2i/t2i.client';

import type { ConversationHandler } from '~/common/chat-overlay/ConversationHandler';
import type { TextToImageProvider } from '~/common/components/useCapabilities';
import { createErrorContentFragment, isContentOrAttachmentFragment, isImageRefPart } from '~/common/stores/chat/chat.fragments';
import { useChatStore } from '~/common/stores/chat/store-chats';


/**
 * Text to image, appended as an 'assistant' message
 */
export async function runImageGenerationUpdatingState(cHandler: ConversationHandler, imageText?: string) {
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

  try {
    const imageContentFragments = await t2iGenerateImageContentFragments(t2iProvider, imageText, repeat, 'global', 'app-chat');

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
        if (!isContentOrAttachmentFragment(fragment) || !isImageRefPart(fragment.part))
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
