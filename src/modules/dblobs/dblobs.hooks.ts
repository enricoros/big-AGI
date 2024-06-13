import { useLiveQuery } from 'dexie-react-hooks';

import type { DBlobAsset, DBlobDBAsset, DBlobId } from './dblobs.types';
import { addDBAsset, deleteDBAsset, getDBAsset, getDBAssetsByScopeAndType, updateDBAsset } from '~/modules/dblobs/dblobs.db';


// export function useDBlobItems<T extends DBlobItem>(assetType: T['assetType']): [T[] | undefined, (item: T, contextId: DBlobDBItem['contextId'], scopeId: DBlobDBItem['scopeId']) => Promise<void>, (id: DBlobId) => Promise<void>] {
//   const items = useLiveQuery(() => getAssetsByType<T>(assetType), [assetType]);
//
//   const addDBlobItemHandler = async (item: T, contextId: DBlobDBItem['contextId'], scopeId: DBlobDBItem['scopeId']) => {
//     await addDBlobItem(item, contextId, scopeId);
//   };
//
//   const deleteDBlobItemHandler = async (id: DBlobId) => {
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
  contextId: DBlobDBAsset['contextId'],
  scopeId: DBlobDBAsset['scopeId'],
): [TAsset[] | undefined, (item: TAsset, contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']) => Promise<DBlobId>, (id: DBlobId) => Promise<void>] {
  const items = useLiveQuery(
    () => getDBAssetsByScopeAndType<TAsset>(assetType, contextId, scopeId),
    [assetType, contextId, scopeId],
  );

  const addDBlobItemHandler = async (item: TAsset, contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']): Promise<DBlobId> => {
    return await addDBAsset(item, contextId, scopeId);
  };

  const deleteDBlobItemHandler = async (id: DBlobId) => {
    await deleteDBAsset(id);
  };

  return [items, addDBlobItemHandler, deleteDBlobItemHandler];
}


export function useDBAsset<T extends DBlobAsset = DBlobDBAsset>(id: DBlobId): [T | undefined, (updates: Partial<T>) => Promise<void>] {
  const item = useLiveQuery(
    () => getDBAsset<T>(id),
    [id],
  );

  const updateDBlobItemHandler = async (updates: Partial<T>) => {
    await updateDBAsset(id, updates);
  };

  return [item, updateDBlobItemHandler];
}

// example custom
// export function useHighResImages(): DBlobImageItem[] | undefined {
//   return useLiveQuery(() => getHighResImages());
// }