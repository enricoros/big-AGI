import Dexie from 'dexie';

import type { DBlobAsset, DBlobAssetId, DBlobAssetType, DBlobDBAsset, DBlobDBContextId, DBlobDBScopeId } from './dblobs.types';


/**
 * Dexie DB for Big-AGI
 * - assets: we store large assets like images/audio/video/documents...
 *
 * [DEV NOTE] To delete the full DB (don't do it!):
 * - indexedDB.deleteDatabase('NAME').onsuccess = console.log;
 *
 * [DEV NOTE] This is related to storageUtils.ts's requestPersistentStorage,
 * aswe need to request persistent storage for the current origin, sot that
 * indexedDB's content is not evicted.
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

// In development mode, reuse the same instance of the DB to avoid re-creating it on every hot reload
const globalForDexie = globalThis as unknown as {
  bigAgiDB: BigAgiDB | undefined;
};

const _db = globalForDexie.bigAgiDB ?? new BigAgiDB();
if (process.env.NODE_ENV !== 'production') globalForDexie.bigAgiDB = _db;

const assetsTable = _db.largeAssets;


// CRUD

export async function _addDBAsset<T extends DBlobAsset>(asset: T, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId): Promise<DBlobAssetId> {
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

// export async function getDBlobAssetIds(): Promise<DBlobAssetId[]> {
//   return assetsTable.toCollection().primaryKeys();
// }

// async function _getDBlobAssetIdsByScope(contextId: DBlobDBContextId, scopeId: DBlobDBScopeId): Promise<DBlobAssetId[]> {
//   return assetsTable.where({
//     contextId: contextId,
//     scopeId: scopeId,
//   }).primaryKeys();
// }

export async function getDBAsset<T extends DBlobAsset = DBlobDBAsset>(id: DBlobAssetId) {
  return await assetsTable.get(id) as T | undefined;
}

/**
 * Warning: this function all the matching assets data in memory - not suitable for large datasets.
 */
// export async function getDBAssetsByType<T extends DBlobAsset = DBlobDBAsset>(assetType: T['assetType']) {
//   return await assetsTable.where({
//     assetType: assetType,
//   }).toArray() as unknown as T[];
// }

/**
 * Warning: this function all the matching assets data in memory - not suitable for large datasets.
 */
export async function getDBAssetsByScopeAndType<T extends DBlobAsset = DBlobDBAsset>(assetType: T['assetType'], contextId: DBlobDBContextId, scopeId: DBlobDBScopeId) {
  const assets = await assetsTable.where({
    assetType: assetType, contextId: contextId, scopeId: scopeId,
  }).sortBy('createdAt');
  return assets.reverse() as unknown as T[];
}


// UPDATE

async function _updateDBAsset<T extends DBlobDBAsset = DBlobDBAsset>(id: DBlobAssetId, updates: Partial<T>) {
  return assetsTable.update(id, updates);
}

export async function transferDBAssetContextScope(id: DBlobAssetId, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId) {
  await _updateDBAsset(id, { contextId, scopeId });
}


// DELETE

export async function deleteDBAsset(id: DBlobAssetId) {
  return assetsTable.delete(id);
}

// export async function deleteDBAssets(ids: DBlobAssetId[]) {
//   return assetsTable.bulkDelete(ids);
// }

// export async function deleteAllScopedAssets(contextId: DBlobDBContextId, scopeId: DBlobDBScopeId) {
//   return (contextId && scopeId) ? assetsTable.where({
//     contextId: contextId,
//     scopeId: scopeId,
//   }).delete() : 0;
// }

export async function gcDBAssetsByScope(contextId: DBlobDBContextId, scopeId: DBlobDBScopeId, assetType: DBlobAssetType | null, keepIds: DBlobAssetId[]) {
  // get all the DB keys
  const dbAssetIds = await assetsTable.where((assetType !== null) ? {
    assetType: assetType,
    contextId: contextId,
    scopeId: scopeId,
  } : {
    contextId: contextId,
    scopeId: scopeId,
  }).primaryKeys();

  // find the unreferenced keys
  const unreferencedAssetIds = keepIds.length ? dbAssetIds.filter(id => !keepIds.includes(id)) : dbAssetIds;

  // delete the unreferenced keys
  if (unreferencedAssetIds.length > 0)
    await assetsTable.bulkDelete(unreferencedAssetIds);
}
