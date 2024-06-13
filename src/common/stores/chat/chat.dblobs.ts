import type { DBlobId, DBlobImageAsset } from '~/modules/dblobs/dblobs.types';
import { addDBAsset, deleteDBAssets, getDBAssetDBlobIds, getImageAssetAsBlobURL } from '~/modules/dblobs/dblobs.db';

import type { DMessageDataRef } from './chat.message';
import { useChatStore } from './store-chats';


// configuration
const DEBUG_SHOW_GC = false;


/**
 * Add a new dblob image item, from the chat
 */
export async function chatDBlobAddGlobalImage(item: DBlobImageAsset): Promise<DBlobId> {
  return await addDBAsset<DBlobImageAsset>(item, 'global', 'app-chat');
}


/**
 * Open a DBlob (image) in a new tab
 */
export async function showImageDataRefInNewTab(dataRef: DMessageDataRef) {
  let imageUrl: string | null = null;
  if (dataRef.reftype === 'url')
    imageUrl = dataRef.url;
  else if (dataRef.reftype === 'dblob')
    imageUrl = await getImageAssetAsBlobURL(dataRef.dblobId);
  if (imageUrl && typeof window !== 'undefined') {
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}

/**
 * Garbage collect unreferenced dblobs in global chats
 */
export async function gcGlobalChatDBlobs() {

  // find all the dblob references in all chats
  const chatsDBlobIDs: Set<DBlobId> = new Set();
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
        chatsDBlobIDs.add(fragment.part.dataRef.dblobId);
      }
    }
  }

  // sanity check: if no blobs are referenced, do nothing; in case we have a bug and we don't wipe the db
  if (!chatsDBlobIDs.size)
    return;

  // find all the dblob ids in the DB
  const dbDBlobIDs: DBlobId[] = await getDBAssetDBlobIds();

  // Determine which blobs are not referenced in any chat
  const unreferencedBlobIDs = dbDBlobIDs.filter(id => !chatsDBlobIDs.has(id));

  // Delete unreferenced blobs
  if (unreferencedBlobIDs.length > 0)
    await deleteDBAssets(unreferencedBlobIDs);

  if (DEBUG_SHOW_GC)
    console.log(`gcGlobalChatDBlobs: ${unreferencedBlobIDs.length}/${chatsDBlobIDs.size} unreferenced blobs deleted.`);
}
