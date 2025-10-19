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

  // FIXME: [ASSET-GC-BEAM] GC deletes assets still referenced in Beam rays, causing images to disappear
  //        Bug occurs when: (1) Beam is open with imported rays containing images, (2) user regenerates/deletes
  //        those messages in the chat pane, (3) GC only scans main conversation store, not Beam vanilla stores,
  //        (4) assets are deleted while still displayed in Beam rays.
  //        Fix: Uncomment code below to scan all Beam stores for asset references before GC.
  //        Note: Also add import: import { ConversationsManager } from '~/common/chat-overlay/ConversationsManager';
  //        Reproduction: Open Beam on right with images → regenerate (Ctrl+Shift+Z) on left -> images disappear.
  //
  // // Scan Beam rays for each conversation
  // for (const conversation of _conversations) {
  //   const handler = ConversationsManager.getHandler(conversation.id);
  //   if (!handler.isValid()) continue;
  //
  //   const rays = handler.beamStore.getState().rays;
  //   for (const ray of rays) {
  //     for (const fragment of ray.message.fragments) {
  //       if (!isContentOrAttachmentFragment(fragment)) continue;
  //
  //       // New References to Zync Assets (dblob refs for compatibility/migration)
  //       if (isZyncAssetReferencePart(fragment.part) && fragment.part._legacyImageRefPart?.dataRef?.reftype === 'dblob')
  //         chatsAssetIDs.add(fragment.part._legacyImageRefPart.dataRef.dblobAssetId);
  //
  //       // Legacy 'image_ref' parts (direct dblob refs)
  //       if (isImageRefPart(fragment.part) && fragment.part.dataRef?.reftype === 'dblob')
  //         chatsAssetIDs.add(fragment.part.dataRef.dblobAssetId);
  //     }
  //   }
  // }

  // sanity check: if no blobs are referenced, do nothing; in case we have a state bug and we don't wipe the db
  if (!chatsAssetIDs.size)
    return;

  // perform the GC (set to array)
  await gcDBImageAssets('global', 'app-chat', Array.from(chatsAssetIDs));

  // FIXME: [ASSET] will only be able to GC local assets that haven't been uploaded to the cloud - otherwise they could be used,
  //        in which case only the cloud can centralized-GC, or user will have to manually delete them

}