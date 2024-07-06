import type { StateStorage } from 'zustand/middleware';
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';


// set to true to enable debugging
const DEBUG_SCHEDULER = false;
const USER_LOG_ISSUES = true;


interface PendingWrite {
  timeoutId: ReturnType<typeof setTimeout> | null;
  firstAttemptTime: number;
  pendingValue: string | null;
}

/**
 * The write scheduler is a simple utility that batches write operations to IndexedDB.
 * Should be reasonably efficient and won't block the main thread. Schreuled writes shall happen within
 * the deadline, which will help the UI survive intense load.
 */
class WriteScheduler {
  private writeOperations: Record<string, PendingWrite> = {};

  constructor(readonly maxDeadline: number = 600, readonly minInterval: number = 250) {
  }

  scheduleWrite(key: string, value: string): void {
    const now = Date.now();
    const operation = this.writeOperations[key] || { timeoutId: null, firstAttemptTime: now, pendingValue: null };

    if (operation.timeoutId !== null) {
      // if (DEBUG_SCHEDULER)
      //   console.warn(' - idb_WS: clr_write', key);
      clearTimeout(operation.timeoutId);
      operation.timeoutId = null;
    }

    if (!operation.firstAttemptTime)
      operation.firstAttemptTime = now;
    operation.pendingValue = value;
    this.writeOperations[key] = operation;

    const timeSinceFirstAttempt = now - operation.firstAttemptTime;
    let writeDelay = this.minInterval;

    if (timeSinceFirstAttempt + this.minInterval > this.maxDeadline)
      writeDelay = this.maxDeadline - timeSinceFirstAttempt;

    if (writeDelay < 10) {
      if (DEBUG_SCHEDULER)
        console.warn(' - idb_WS: deadline write', key, '(delay:', writeDelay, ')');
      this.performWrite(key).catch(error => {
        if (USER_LOG_ISSUES)
          console.warn('idbUtils: E1: writing', key, error);
      });
    } else {
      if (DEBUG_SCHEDULER)
        console.warn(' - idb_WS: schedule', key, 'at', writeDelay, 'ms');
      operation.timeoutId = setTimeout(() => {
        this.performWrite(key).catch(error => {
          if (USER_LOG_ISSUES)
            console.warn('idbUtils: E2: writing', key, error);
        });
      }, writeDelay);
    }
  }

  async performWrite(key: string): Promise<void> {
    const operation = this.writeOperations[key];
    if (!operation) {
      if (USER_LOG_ISSUES)
        console.warn('idbUtils: write operation not found for', key);
      return;
    }
    const walueToWrite = operation.pendingValue;
    operation.timeoutId = null;
    operation.firstAttemptTime = 0;
    operation.pendingValue = null;
    if (walueToWrite === null) {
      if (USER_LOG_ISSUES)
        console.warn('idbUtils: write operation has no pending value for', key);
    } else {
      const start = Date.now();
      if (DEBUG_SCHEDULER)
        console.log(' - idb: [SET]', key);
      await idbSet(key, walueToWrite);
      if (DEBUG_SCHEDULER)
        console.warn('   (write time:', Date.now() - start, 'ms, bytes:', walueToWrite.length.toLocaleString(), ')');
    }
  }

  async retrievePendingWrite(key: string): Promise<string | null> {
    // If there's a pending value, return it immediately
    const operation = this.writeOperations[key];
    if (operation && operation.pendingValue !== null) {
      if (DEBUG_SCHEDULER)
        console.warn(' - idb_WS: read_pending', key, 'deadline:', operation.firstAttemptTime + this.maxDeadline - Date.now(), 'ms');
      return operation.pendingValue;
    }

    // If there's no operation or pending value, return null indicating no data is available
    return null;
  }
}

const writeScheduler = new WriteScheduler(1000, 400);


/**
 * A Zustand state storage implementation that uses IndexedDB as a simple key-value store
 */
export const idbStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    // if (DEBUG_SCHEDULER)
    //   console.warn(' - idb: get', name);

    // If there's a pending value, return it directly
    const pendingValue = await writeScheduler.retrievePendingWrite(name);
    if (pendingValue !== null)
      return pendingValue;

    // If there's no pending value, proceed to fetch from IndexedDB
    if (DEBUG_SCHEDULER)
      console.warn(' - idb: [GET]', name);
    const value: string | undefined = await idbGet(name);
    if (DEBUG_SCHEDULER)
      console.warn('   (read bytes:', value?.length?.toLocaleString(), ')');

    return value || null;
  },
  setItem: (name: string, value: string): void => {
    // if (DEBUG_SCHEDULER)
    //   console.warn(' - idb: set', name);

    writeScheduler.scheduleWrite(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    if (DEBUG_SCHEDULER)
      console.warn(' - idb: del', name);
    await idbDel(name);
  },
};


/// Maintenance

/* Sets a single key-value in a given IndexedDB key-value store.

function setValue(dbName, key, value) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = event => reject(new Error('Error opening database: ' + event.target.error));
    request.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction('keyval', 'readwrite');
      const store = transaction.objectStore('keyval');

      const updateRequest = store.put(value, key);
      updateRequest.onerror = event => reject(new Error('Error updating JSON string: ' + event.target.error));
      updateRequest.onsuccess = () => resolve('Successfully updated JSON string.');
    };
  });
}

function copyValue(dbName, sourceKey, targetKey) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = event => reject(new Error('Error opening database: ' + event.target.error));
    request.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction('keyval', 'readwrite');
      const store = transaction.objectStore('keyval');

      const getRequest = store.get(sourceKey);
      getRequest.onerror = event => reject(new Error('Error retrieving value: ' + event.target.error));
      getRequest.onsuccess = () => {
        const value = getRequest.result;

        if (value === undefined) {
          reject(new Error(`No value found for key: ${sourceKey}`));
          return;
        }

        const putRequest = store.put(value, targetKey);
        putRequest.onsuccess = () => resolve(`Successfully copied value from ${sourceKey} to ${targetKey}.`);
        putRequest.onerror = event => reject(new Error('Error copying value: ' + event.target.error));
      };
    };
  });
}

function deleteValue(dbName, key) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onerror = event => reject(new Error('Error opening database: ' + event.target.error));
    request.onsuccess = event => {
      const db = event.target.result;
      const transaction = db.transaction('keyval', 'readwrite');
      const store = transaction.objectStore('keyval');

      const deleteRequest = store.delete(key);
      deleteRequest.onerror = event => reject(new Error('Error deleting value: ' + event.target.error));
      deleteRequest.onsuccess = () => resolve(`Successfully deleted value for key: ${key}.`);
    };
  });
}

// Example usage:
const myNewJsonString = '{"your": "new json string"}'; // Replace with your desired JSON string
await setValue('keyval-store', 'app-chats', myNewJsonString);
await copyValue('keyval-store', 'app-chats', 'app-chats-copy');
await deleteValue('keyval-store', 'app-chats-prev');

*/
