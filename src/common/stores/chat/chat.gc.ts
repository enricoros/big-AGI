import { DBlobAssetId, gcDBImageAssets } from '~/common/stores/blob/dblobs-portability';

import type { Immutable } from '~/common/types/immutable.types';

import type { DConversation } from './chat.conversation';
import type { DMessageFragment } from './chat.fragments';
import { isContentOrAttachmentFragment, isImageRefPart, isZyncAssetReferencePart } from './chat.fragments';
import { useChatStore } from './store-chats';


// --- Asset collector registration ---


/**
 * Allows external systems (Beam, scratch chat, etc.), to protect their DBlob assets from GC without creating circular dependencies.
 */
const _assetCollectors: AssetCollectorFn[] = [];
type AssetCollectorFn = () => DBlobAssetId[];

/**
 * Register a callback that returns additional DBlob asset IDs to keep during GC.
 * Uses inversion of control to avoid circular dependency (chat/ -> chat-overlay/).
 * @returns unregister function
 */
export function gcRegisterAssetCollector(collector: AssetCollectorFn): () => void {
  _assetCollectors.push(collector);
  return () => {
    const idx = _assetCollectors.indexOf(collector);
    if (idx >= 0) _assetCollectors.splice(idx, 1);
  };
}


/**
 * Collect DBlob asset IDs referenced in message fragments.
 */
export function collectFragmentAssetIds(fragments: Immutable<DMessageFragment[]>, assetIds: Set<DBlobAssetId>): void {
  for (const fragment of fragments) {
    if (!isContentOrAttachmentFragment(fragment)) continue;

    // New References to Zync Assets (dblob refs for compatibility/migration)
    if (isZyncAssetReferencePart(fragment.part) && fragment.part._legacyImageRefPart?.dataRef?.reftype === 'dblob')
      assetIds.add(fragment.part._legacyImageRefPart.dataRef.dblobAssetId);

    // Legacy 'image_ref' parts (direct dblob refs)
    if (isImageRefPart(fragment.part) && fragment.part.dataRef?.reftype === 'dblob')
      assetIds.add(fragment.part.dataRef.dblobAssetId);
  }
}


/**
 * Garbage collect unreferenced dblobs in global chats
 * - This is ran as a side effect of the chat store rehydration
 * - This is also ran when a conversation or message is deleted, or when a conversation messages history is replaced
 */
export async function gcChatImageAssets(conversations?: Immutable<DConversation[]>) {

  // find all the dblob references in all chats
  const chatsAssetIDs: Set<DBlobAssetId> = new Set();
  const _conversations = conversations || useChatStore.getState().conversations;
  for (const chat of _conversations)
    for (const message of chat.messages)
      collectFragmentAssetIds(message.fragments, chatsAssetIDs);

  // [ASSET-GC-BEAM] Collect additional asset IDs from registered collectors (Beam, scratch chat, etc.)
  // to prevent GC from deleting assets still displayed in ephemeral overlay stores (e.g. Beam rays/fusions).
  // Bug: Beam images disappeared when regenerating/deleting chat messages while Beam was open, because
  // GC only scanned conversation messages and not the vanilla Beam stores. Registration pattern avoids
  // the circular dependency (chat/ -> chat-overlay/).
  for (const collector of _assetCollectors)
    for (const assetId of collector())
      chatsAssetIDs.add(assetId);

  // sanity check: if no blobs are referenced, do nothing; in case we have a state bug and we don't wipe the db
  if (!chatsAssetIDs.size)
    return;

  // perform the GC (set to array)
  await gcDBImageAssets('global', 'app-chat', Array.from(chatsAssetIDs));

  // FIXME: [ASSET] will only be able to GC local assets that haven't been uploaded to the cloud - otherwise they could be used,
  //        in which case only the cloud can centralized-GC, or user will have to manually delete them

}
