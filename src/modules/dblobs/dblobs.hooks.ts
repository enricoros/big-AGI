import { useLiveQuery } from 'dexie-react-hooks';

import type { DBlobAsset, DBlobAssetId, DBlobDBAsset, DBlobDBContextId, DBlobDBScopeId } from './dblobs.types';
import { getDBAsset, getDBAssetsByScopeAndType } from './dblobs.db';


// export function useDBlobItems<T extends DBlobItem>(assetType: T['assetType']): [T[] | undefined, (item: T, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId) => Promise<void>, (id: DBlobAssetId) => Promise<void>] {
//   const items = useLiveQuery(() => getAssetsByType<T>(assetType), [assetType]);
//
//   const addDBlobItemHandler = async (item: T, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId) => {
//     await addDBlobItem(item, contextId, scopeId);
//   };
//
//   const deleteDBlobItemHandler = async (id: DBlobAssetId) => {
//     await deleteDBlobItem(id);
//   };
//
//   return [items, addDBlobItemHandler, deleteDBlobItemHandler];
// }

/**
 * Warning - this function will load all data in memory and will be incredibly slow for large datasets.
 * TODO: convert to an index + cursor based approach
 */
export function useDBAssetsByScopeAndType<TAsset extends DBlobAsset = DBlobDBAsset>(
  assetType: TAsset['assetType'],
  contextId: DBlobDBContextId,
  scopeId: DBlobDBScopeId,
): [TAsset[] | undefined, /*(item: TAsset, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId) => Promise<DBlobAssetId>, (id: DBlobAssetId) => Promise<void>*/] {
  const items = useLiveQuery(
    () => getDBAssetsByScopeAndType<TAsset>(assetType, contextId, scopeId),
    [assetType, contextId, scopeId],
  );

  // const addDBlobItemHandler = async (item: TAsset, contextId: DBlobDBContextId, scopeId: DBlobDBScopeId): Promise<DBlobAssetId> => {
  //   return await addDBAsset(item, contextId, scopeId);
  // };

  // const deleteDBlobItemHandler = async (id: DBlobAssetId) => {
  //   await deleteDBAsset(id);
  // };

  return [items];
}


export function useDBAsset<T extends DBlobAsset = DBlobDBAsset>(id: DBlobAssetId): [T | undefined /*, (updates: Partial<T>) => Promise<void>*/] {
  const item = useLiveQuery(
    () => getDBAsset<T>(id),
    [id],
  );

  // const updateDBlobItemHandler = async (updates: Partial<T>) => {
  //   await updateDBAsset(id, updates);
  // };

  return [item /*, updateDBlobItemHandler */];
}

// example custom
// export function useHighResImages(): DBlobImageItem[] | undefined {
//   return useLiveQuery(() => getHighResImages());
// }