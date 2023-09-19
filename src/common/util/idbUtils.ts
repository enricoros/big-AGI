import type { StateStorage } from 'zustand/middleware';
import { del, get, set } from 'idb-keyval';

export const IDB_MIGRATION_INITIAL = -1;

/**
 * A Zustand state storage implementation that uses IndexedDB as a simple key-value store
 */
export const idbStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const value = await get(name);
    /* IMPORTANT!
     * We modify the default behavior of `getItem` to return a {version: -1} object if a key is not found.
     * This is to trigger the migration across state storage implementations, as Zustand would not call the
     * 'migrate' function otherwise.
     * See 'https://github.com/enricoros/big-agi/pull/158' for more details
     */
    if (value === undefined) {
      return JSON.stringify({
        version: IDB_MIGRATION_INITIAL,
      });
    }
    return value || null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};