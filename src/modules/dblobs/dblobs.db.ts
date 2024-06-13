import Dexie from 'dexie';

import { DBlobAsset, DBlobAssetType, DBlobAudioAsset, DBlobDBAsset, DBlobId, DBlobImageAsset, DBlobMimeType } from './dblobs.types';
import { resizeBase64ImageIfNeeded } from '~/common/util/imageUtils';


/**
 * Dexie DB for Big-AGI
 * - assets: we store large assets like images/audio/video/documents...
 *
 * [DEV NOTE] To delete the full DB (don't do it!):
 * - indexedDB.deleteDatabase('NAME').onsuccess = console.log;
 */
class BigAgiDB extends Dexie {
  largeAssets!: Dexie.Table<DBlobDBAsset, string>;

  constructor() {
    super('Big-AGI');
    this.version(1).stores({
      // Index common properties (and compound indexes)
      largeAssets: 'id, contextId, scopeId, [contextId+scopeId], type, [type+contextId+scopeId], data.mimeType, origin.ot, origin.source, createdAt, updatedAt',
    });
    // Note: can re-add wId and uId in version 2 if needed
  }
}

/**
 * In development mode, reuse the same instance of the DB to avoid re-creating it on every hot reload
 */
const globalForDexie = globalThis as unknown as {
  bigAgiDB: BigAgiDB | undefined;
};

const _db = globalForDexie.bigAgiDB ?? new BigAgiDB();
if (process.env.NODE_ENV !== 'production') globalForDexie.bigAgiDB = _db;

const assetsTable = _db.largeAssets;


// CRUD


export async function addDBlobItem<T extends DBlobAsset>(item: T, contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']): Promise<DBlobId> {

  // Auto-Thumbnail: when adding an image, generate a thumbnail-256 cache level
  if (item.type === 'image') {
    if (!item.cache?.thumb256) {
      const imageItem = item as DBlobImageAsset;
      const resizedDataForCache = await resizeBase64ImageIfNeeded(imageItem.data.mimeType, imageItem.data.base64, 'thumbnail-256', DBlobMimeType.IMG_WEBP, 0.9)
        .catch((error: any) => console.error('addDBlobItem: Error resizing image', error));
      if (resizedDataForCache) {
        item.cache.thumb256 = {
          base64: resizedDataForCache.base64,
          mimeType: DBlobMimeType.IMG_WEBP,
        };
      }
    }
  }

  try {
    // returns the id of the added item
    return await assetsTable.add({
      ...item,
      contextId,
      scopeId,
    });
  } catch (error) {
    console.error('addDBlobItem: Error adding item', error);
    throw error;
  }
}

export async function getDBlobItemIDs() {
  return assetsTable.toCollection().primaryKeys();
}

export async function getItemById<T extends DBlobAsset = DBlobAsset>(id: DBlobId) {
  return await assetsTable.get(id) as T | undefined;
}

export async function getDBlobItemsByType<T extends DBlobAsset>(type: T['type']) {
  return await assetsTable.where({ type }).toArray() as unknown as T[];
}

export async function getDBlobItemsByTypeContextIdScopeId<T extends DBlobAsset>(type: T['type'], contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']) {
  const items = await assetsTable.where({ type, contextId, scopeId }).sortBy('createdAt');
  return items.reverse() as unknown as T[];
}

export async function getItemsByMimeType<T extends DBlobAsset>(mimeType: T['data']['mimeType']) {
  return await assetsTable.where('data.mimeType').equals(mimeType).toArray() as unknown as T[];
}


export async function updateDBlobItem(id: DBlobId, updates: Partial<DBlobAsset>) {
  return assetsTable.update(id, updates);
}

export async function deleteDBlobItem(id: DBlobId) {
  return assetsTable.delete(id);
}

export async function deleteDBlobItems(ids: DBlobId[]) {
  return assetsTable.bulkDelete(ids);
}

export async function deleteAllDBlobsInScopeId(contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']) {
  return assetsTable.where({ contextId, scopeId }).delete();
}


// Specific item types
async function getImageItemById(id: DBlobId) {
  return await getItemById<DBlobImageAsset>(id);
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
async function getAllImages(): Promise<DBlobImageAsset[]> {
  return await getDBlobItemsByType<DBlobImageAsset>(DBlobAssetType.IMAGE);
}

async function getAllAudio(): Promise<DBlobAudioAsset[]> {
  return await getDBlobItemsByType<DBlobAudioAsset>(DBlobAssetType.AUDIO);
}

async function getHighResImages() {
  return await assetsTable
    .where('data.mimeType')
    .startsWith('image/')
    .and(item => (item as DBlobImageAsset).metadata.width > 1920)
    .toArray() as DBlobImageAsset[];
}
