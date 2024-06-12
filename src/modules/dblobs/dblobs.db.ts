import Dexie from 'dexie';

import { DBlobAudioItem, dBlobCacheT256, DBlobDBItem, DBlobId, DBlobImageItem, DBlobItem, DBlobMetaDataType, DBlobMimeType } from './dblobs.types';
import { resizeBase64ImageIfNeeded } from '~/common/util/imageUtils';


class DigitalAssetsDB extends Dexie {
  items!: Dexie.Table<DBlobDBItem, string>;

  constructor() {
    super('DigitalAssetsDB');
    this.version(1).stores({
      items: 'id, uId, wId, cId, sId, type, data.mimeType, origin.ot, origin.source, createdAt, updatedAt', // Index common properties
    });
  }
}

const db = new DigitalAssetsDB();


// CRUD

const DEFAULT_USER_ID = '1';
const DEFAULT_WORKSPACE_ID = '1';

export async function addDBlobItem<T extends DBlobItem>(item: T, cId: DBlobDBItem['cId'], sId: DBlobDBItem['sId']): Promise<DBlobId> {

  // Auto-Thumbnail: when adding an image, generate a thumbnail-256 cache level
  if (item.type === DBlobMetaDataType.IMAGE) {
    if (!item.cache?.[dBlobCacheT256]) {
      const imageItem = item as DBlobImageItem;
      const resizedDataForCache = await resizeBase64ImageIfNeeded(imageItem.data.mimeType, imageItem.data.base64, 'thumbnail-256', DBlobMimeType.IMG_WEBP, 0.9)
        .catch((error: any) => console.log('addDBlobItem: Error resizing image', error));
      if (resizedDataForCache) {
        item.cache[dBlobCacheT256] = {
          base64: resizedDataForCache.base64,
          mimeType: DBlobMimeType.IMG_WEBP,
        };
      }
    }
  }

  // returns the id of the added item
  return db.items.add({
    ...item,
    uId: DEFAULT_USER_ID,
    wId: DEFAULT_WORKSPACE_ID,
    cId,
    sId,
  });
}

export async function getDBlobItemsByType<T extends DBlobItem>(type: T['type']) {
  return await db.items.where('type').equals(type).toArray() as unknown as T[];
}

export async function getDBlobItemsByTypeCIdSid<T extends DBlobItem>(type: T['type'], cId: DBlobDBItem['cId'], sId: DBlobDBItem['sId']) {
  return (await db.items.where({ type, cId, sId }).sortBy('createdAt')).reverse() as unknown as T[];
}

export async function getDBlobItemIDs() {
  return db.items.toCollection().primaryKeys();
}

export async function getItemsByMimeType<T extends DBlobItem>(mimeType: T['data']['mimeType']) {
  return await db.items.where('data.mimeType').equals(mimeType).toArray() as unknown as T[];
}

export async function getItemById<T extends DBlobItem = DBlobItem>(id: DBlobId) {
  return await db.items.get(id) as T | undefined;
}

export async function updateDBlobItem(id: DBlobId, updates: Partial<DBlobItem>) {
  return db.items.update(id, updates);
}

export async function deleteDBlobItem(id: DBlobId) {
  return db.items.delete(id);
}

export async function deleteDBlobItems(ids: DBlobId[]) {
  return db.items.bulkDelete(ids);
}

export async function deleteAllDBlobsInScopeId(cId: DBlobDBItem['cId'], sId: DBlobDBItem['sId']) {
  return db.items.where({ cId, sId }).delete();
}


// Specific item types
async function getImageItemById(id: DBlobId) {
  return await getItemById<DBlobImageItem>(id);
}

export async function getImageDataURLById(id: DBlobId) {
  const item = await getImageItemById(id);
  return item ? `data:${item.data.mimeType};base64,${item.data.base64}` : null;
}

export async function getImageBlobURLById(id: DBlobId) {
  const item = await getImageItemById(id);
  if (item) {
    const byteCharacters = atob(item.data.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: item.data.mimeType });
    return URL.createObjectURL(blob);
  }
  return null;
}

// Example usage:
async function getAllImages(): Promise<DBlobImageItem[]> {
  return await getDBlobItemsByType<DBlobImageItem>(DBlobMetaDataType.IMAGE);
}

async function getAllAudio(): Promise<DBlobAudioItem[]> {
  return await getDBlobItemsByType<DBlobAudioItem>(DBlobMetaDataType.AUDIO);
}

async function getHighResImages() {
  return await db.items
    .where('data.mimeType')
    .startsWith('image/')
    .and(item => (item as DBlobImageItem).metadata.width > 1920)
    .toArray() as DBlobImageItem[];
}
