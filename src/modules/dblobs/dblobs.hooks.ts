import { useLiveQuery } from 'dexie-react-hooks';

import type { DBlobDBItem, DBlobItem } from './dblobs.types';
import { addDBlobItem, deleteDBlobItem, getDBlobItemsByType, getItemById, updateDBlobItem } from './dblobs.db';


export function useDBlobItems<T extends DBlobItem>(type: T['type']): [T[] | undefined, (item: T, cId: DBlobDBItem['cId'], sId: DBlobDBItem['sId']) => Promise<void>, (id: string) => Promise<void>] {
  const items = useLiveQuery(() => getDBlobItemsByType<T>(type));

  const addDBlobItemHandler = async (item: T, cId: DBlobDBItem['cId'], sId: DBlobDBItem['sId']) => {
    await addDBlobItem(item, cId, sId);
  };

  const deleteDBlobItemHandler = async (id: string) => {
    await deleteDBlobItem(id);
  };

  return [items, addDBlobItemHandler, deleteDBlobItemHandler];
}


export function useDBlobItem<T extends DBlobItem>(id: string): [T | undefined, (updates: Partial<T>) => Promise<void>] {
  const item = useLiveQuery(() => getItemById<T>(id));

  const updateDBlobItemHandler = async (updates: Partial<T>) => {
    await updateDBlobItem(id, updates);
  };

  return [item, updateDBlobItemHandler];
}

// example custom
// export function useHighResImages(): DBlobImageItem[] | undefined {
//   return useLiveQuery(() => getHighResImages());
// }