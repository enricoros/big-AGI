import type { DBlobId, DBlobImageItem } from '~/modules/dblobs/dblobs.types';
import { addDBlobItem, deleteDBlobItems, getDBlobItemIDs, getImageBlobURLById } from '~/modules/dblobs/dblobs.db';

import type { DMessageDataRef } from './chat.message';
import { useChatStore } from './store-chats';


// configuration
const DEBUG_SHOW_GC = true;


export async function chatDBlobAddGlobalImage(item: DBlobImageItem): Promise<DBlobId> {
  return await addDBlobItem<DBlobImageItem>(item, 'global', 'app-chat');
}

/**
 * Note: this utility function could be extracted more broadly to chat.message.ts, but
 * I don't want to introduce a (circular) dependency from chat.message.ts to dblobs.db.ts.
 */
export async function handleShowDataRefInNewTab(dataRef: DMessageDataRef) {
  let imageUrl: string | null = null;
  if (dataRef.reftype === 'url')
    imageUrl = dataRef.url;
  else if (dataRef.reftype === 'dblob')
    imageUrl = await getImageBlobURLById(dataRef.dblobId);
  if (imageUrl && typeof window !== 'undefined')
    window.open(imageUrl, '_blank', 'noopener,noreferrer');
}

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

  // find all the dblob ids in the DB
  const dbDBlobIDs: DBlobId[] = await getDBlobItemIDs();

  // Determine which blobs are not referenced in any chat
  const unreferencedBlobIDs = dbDBlobIDs.filter(id => !chatsDBlobIDs.has(id));

  // Delete unreferenced blobs
  if (unreferencedBlobIDs.length > 0)
    await deleteDBlobItems(unreferencedBlobIDs);

  if (DEBUG_SHOW_GC)
    console.log(`gcGlobalChatDBlobs: ${unreferencedBlobIDs.length}/${chatsDBlobIDs.size} unreferenced blobs deleted.`);
}