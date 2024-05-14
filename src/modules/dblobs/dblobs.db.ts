import Dexie from 'dexie';

import { DBlobAudioItem, DBlobDBItem, DBlobImageItem, DBlobItem, DBlobMetaDataType } from './dblobs.types';


class DigitalAssetsDB extends Dexie {
  items!: Dexie.Table<DBlobDBItem, string>;

  constructor() {
    super('DigitalAssetsDB');
    this.version(1).stores({
      items: 'id, uId, wId, cId, type, data.mimeType, origin.origin, origin.dir, origin.source, createdAt, updatedAt', // Index common properties
    });
  }
}

const db = new DigitalAssetsDB();


// CRUD


export async function addDBlobItem(item: DBlobItem): Promise<void> {
  const dbItem: DBlobDBItem = {
    ...item,
    uId: '1',
    wId: '1',
    cId: 'global', // context Id
  };
  await db.items.add(dbItem);
}

export async function getDBlobItemsByType<T extends DBlobItem>(type: T['type']) {
  return await db.items.where('type').equals(type).toArray() as unknown as T[];
}

export async function getItemsByMimeType<T extends DBlobItem>(mimeType: T['data']['mimeType']) {
  return await db.items.where('data.mimeType').equals(mimeType).toArray() as unknown as T[];
}

export async function getItemById<T extends DBlobItem = DBlobItem>(id: string) {
  return await db.items.get(id) as T | undefined;
}

export async function updateDBlobItem(id: string, updates: Partial<DBlobItem>) {
  return db.items.update(id, updates);
}

export async function deleteDBlobItem(id: string) {
  return db.items.delete(id);
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
