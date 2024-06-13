import Dexie from 'dexie';

import { DBlobAsset, DBlobAssetType, DBlobDBAsset, DBlobId, DBlobImageAsset, DBlobMimeType } from './dblobs.types';
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
      largeAssets: 'id, [contextId+scopeId], assetType, [assetType+contextId+scopeId], data.mimeType, origin.ot, origin.source, createdAt, updatedAt',
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

export async function addDBAsset<T extends DBlobAsset>(asset: T, contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']): Promise<DBlobId> {

  // Auto-Thumbnail: when adding an image, generate a thumbnail-256 cache level
  if (asset.assetType === DBlobAssetType.IMAGE) {
    if (!asset.cache?.thumb256) {
      const imageAsset = asset as DBlobImageAsset;
      const resizedDataForCache = await resizeBase64ImageIfNeeded(imageAsset.data.mimeType, imageAsset.data.base64, 'thumbnail-256', DBlobMimeType.IMG_WEBP, 0.9)
        .catch((error: any) => console.error('addDBAsset: Error resizing image', error));
      if (resizedDataForCache) {
        asset.cache.thumb256 = {
          base64: resizedDataForCache.base64,
          mimeType: DBlobMimeType.IMG_WEBP,
        };
      }
    }
  }

  try {
    // returns the id of the added asset
    return await assetsTable.add({
      ...asset,
      contextId,
      scopeId,
    });
  } catch (error) {
    console.error('addDBAsset: Error adding asset', error);
    throw error;
  }
}


// READ

export async function getDBAssetDBlobIds(): Promise<DBlobId[]> {
  return assetsTable.toCollection().primaryKeys();
}

export async function getDBAsset<T extends DBlobAsset = DBlobDBAsset>(id: DBlobId) {
  return await assetsTable.get(id) as T | undefined;
}

/**
 * Warning: this function all the matching assets data in memory - not suitable for large datasets.
 */
export async function getDBAssetsByType<T extends DBlobAsset = DBlobDBAsset>(assetType: T['assetType']) {
  return await assetsTable.where({
    assetType: assetType,
  }).toArray() as unknown as T[];
}

/**
 * Warning: this function all the matching assets data in memory - not suitable for large datasets.
 */
export async function getDBAssetsByScopeAndType<T extends DBlobAsset = DBlobDBAsset>(assetType: T['assetType'], contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']) {
  const assets = await assetsTable.where({
    assetType: assetType, contextId: contextId, scopeId: scopeId,
  }).sortBy('createdAt');
  return assets.reverse() as unknown as T[];
}


// UPDATE

export async function updateDBAsset<T extends DBlobAsset = DBlobDBAsset>(id: DBlobId, updates: Partial<T>) {
  return assetsTable.update(id, updates);
}


// DELETE

export async function deleteDBAsset(id: DBlobId) {
  return assetsTable.delete(id);
}

export async function deleteDBAssets(ids: DBlobId[]) {
  return assetsTable.bulkDelete(ids);
}

export async function deleteAllScopedAssets(contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']) {
  return (contextId && scopeId) ? assetsTable.where({
    contextId: contextId,
    scopeId: scopeId,
  }).delete() : 0;
}


// Specific asset types
async function getImageAsset(id: DBlobId) {
  return await getDBAsset<DBlobImageAsset>(id);
}

export async function getImageAssetAsDataURL(id: DBlobId) {
  const imageAsset = await getImageAsset(id);
  return imageAsset ? `data:${imageAsset.data.mimeType};base64,${imageAsset.data.base64}` : null;
}

export async function getImageAssetAsBlobURL(id: DBlobId) {
  const imageAsset = await getImageAsset(id);
  if (imageAsset) {
    const byteCharacters = atob(imageAsset.data.base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: imageAsset.data.mimeType });
    return URL.createObjectURL(blob);
  }
  return null;
}

// Example usage:
//
// async function getAllImages() {
//   return await getDBAssetsByType<DBlobImageAsset>(DBlobAssetType.IMAGE);
// }
//
// async function getAllAudio() {
//   return await getDBAssetsByType<DBlobAudioAsset>(DBlobAssetType.AUDIO);
// }
