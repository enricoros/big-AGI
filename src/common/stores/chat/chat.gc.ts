import { DBlobAssetId, gcDBImageAssets } from '~/common/stores/blob/dblobs-portability';

import type { DConversation } from './chat.conversation';
import { isContentOrAttachmentFragment, isImageRefPart, isZyncAssetReferencePart } from './chat.fragments';
import { useChatStore } from './store-chats';

/**
 * Garbage collect unreferenced dblobs in global chats
 * - This is ran as a side effect of the chat store rehydration
 * - This is also ran when a conversation or message is deleted, or when a conversation messages history is replaced
 */
export async function gcChatImageAssets(conversations?: DConversation[]) {

  // find all the dblob references in all chats
  const chatsAssetIDs: Set<DBlobAssetId> = new Set();
  const _conversations = conversations || useChatStore.getState().conversations;
  for (const chat of _conversations) {
    for (const message of chat.messages) {
      for (const fragment of message.fragments) {

        // only operate on content or attachment fragments
        if (!isContentOrAttachmentFragment(fragment)) continue;

        // New References to Zync Assets (dblob refs for compatibility/migration)
        if (isZyncAssetReferencePart(fragment.part) && fragment.part._legacyImageRefPart?.dataRef?.reftype === 'dblob')
          chatsAssetIDs.add(fragment.part._legacyImageRefPart.dataRef.dblobAssetId);

        // Legacy 'image_ref' parts (direct dblob refs)
        if (isImageRefPart(fragment.part) && fragment.part.dataRef?.reftype === 'dblob')
          chatsAssetIDs.add(fragment.part.dataRef.dblobAssetId);
      }
    }
  }

  // sanity check: if no blobs are referenced, do nothing; in case we have a state bug and we don't wipe the db
  if (!chatsAssetIDs.size)
    return;

  // perform the GC (set to array)
  await gcDBImageAssets('global', 'app-chat', Array.from(chatsAssetIDs));

  // FIXME: [ASSET] will only be able to GC local assets that haven't been uploaded to the cloud - otherwise they could be used,
  //        in which case only the cloud can centralized-GC, or user will have to manually delete them

}