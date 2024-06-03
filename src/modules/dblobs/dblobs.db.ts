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

const DEFAULT_USER_ID = '1';
const DEFAULT_WORKSPACE_ID = '1';

export async function addDBlobItem(item: DBlobItem, cId: 'global', sId: DBlobDBItem['sId']): Promise<string> {
  // returns the id of the added item
  return db.items.add({
    ...item,
    uId: DEFAULT_USER_ID, wId: DEFAULT_WORKSPACE_ID, cId, sId,
  });
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


// Specific item types
async function getImageItemById(id: string) {
  return await getItemById<DBlobImageItem>(id);
}

export async function getImageDataURLById(id: string) {
  const item = await getImageItemById(id);
  return item ? `data:${item.data.mimeType};base64,${item.data.base64}` : null;
}

export async function getImageBlobURLById(id: string) {
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
