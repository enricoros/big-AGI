import { useLiveQuery } from 'dexie-react-hooks';

import type { DBlobAsset, DBlobDBAsset } from './dblobs.types';
import { addDBlobItem, deleteDBlobItem, getDBlobItemsByTypeContextIdScopeId, getItemById, updateDBlobItem } from './dblobs.db';


// export function useDBlobItems<T extends DBlobItem>(type: T['type']): [T[] | undefined, (item: T, contextId: DBlobDBItem['contextId'], scopeId: DBlobDBItem['scopeId']) => Promise<void>, (id: string) => Promise<void>] {
//   const items = useLiveQuery(() => getDBlobItemsByType<T>(type), [type]);
//
//   const addDBlobItemHandler = async (item: T, contextId: DBlobDBItem['contextId'], scopeId: DBlobDBItem['scopeId']) => {
//     await addDBlobItem(item, contextId, scopeId);
//   };
//
//   const deleteDBlobItemHandler = async (id: string) => {
//     await deleteDBlobItem(id);
//   };
//
//   return [items, addDBlobItemHandler, deleteDBlobItemHandler];
// }

export function useDBlobItemsByTypeContextIdScopeId<T extends DBlobAsset>(type: T['type'], contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']): [T[] | undefined, (item: T, contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']) => Promise<void>, (id: string) => Promise<void>] {
  const items = useLiveQuery(
    () => getDBlobItemsByTypeContextIdScopeId<T>(type, contextId, scopeId),
    [type, contextId, scopeId],
  );

  const addDBlobItemHandler = async (item: T, contextId: DBlobDBAsset['contextId'], scopeId: DBlobDBAsset['scopeId']) => {
    await addDBlobItem(item, contextId, scopeId);
  };

  const deleteDBlobItemHandler = async (id: string) => {
    await deleteDBlobItem(id);
  };

  return [items, addDBlobItemHandler, deleteDBlobItemHandler];
}


export function useDBlobItem<T extends DBlobAsset>(id: string): [T | undefined, (updates: Partial<T>) => Promise<void>] {
  const item = useLiveQuery(
    () => getItemById<T>(id),
    [id],
  );

  const updateDBlobItemHandler = async (updates: Partial<T>) => {
    await updateDBlobItem(id, updates);
  };

  return [item, updateDBlobItemHandler];
}

// example custom
// export function useHighResImages(): DBlobImageItem[] | undefined {
//   return useLiveQuery(() => getHighResImages());
// }