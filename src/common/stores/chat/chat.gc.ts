import type { DBlobAssetId } from '~/modules/dblobs/dblobs.types';
import { gcDBImageAssets } from '~/modules/dblobs/dblobs.images';

import type { DConversation } from './chat.conversation';
import { isContentOrAttachmentFragment, isImageRefPart } from './chat.fragments';
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