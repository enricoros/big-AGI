/**
 * Copyright (c) 2024 Enrico Ros
 *
 * Faster Zustand storage backend serializing objects just before write.
 * Moreover uses a deadline-based scheduler to batch writes, with an aggregation window.
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { get as idbGet, set as idbSet } from 'idb-keyval';


// [DEV] configuration
const DEBUG_SCHEDULER = false;
const IDB_MERGE_WINDOW = 321;   // not a magic number, just a random value
const IDB_DEADLINE = 1234;      // breaks the pace


type SetKey = string;

type SetOperation = {
  queueDeadline: number | null;
  scheduledTimerId: ReturnType<typeof setTimeout> | null;
  lastState: null | StorageValue<any>;
  needsWrite: boolean;
  isWriting: boolean; // [r: all, w: performWrite]
};


const _warn = (...args: any[]) => console.warn('IndexedDB:', ...args);
const _devWarn = (...args: any[]) => console.warn('[DEV] IndexedDB:', ...args);


class IndexedDBWriteScheduler {

  private writeOperations: Record<SetKey, SetOperation> = {};

  constructor(readonly mergeWindow: number, readonly deadline: number) {
  }


  async getItem<S>(key: SetKey): Promise<StorageValue<S> | null> {
    // in-mem recycle: unexpected, but implemented
    const operation = this.writeOperations[key];
    if (operation && operation.lastState !== null) {
      _devWarn(`unexpected in-mem recycle of '${key}'`);
      return operation.lastState;
    }

    // fetch from IDB
    const jsonState = await this.#idbReadString(key);
    if (jsonState === null) return null; // first time is null (not found in storage)

    // deserialize
    try {
      return JSON.parse(jsonState) as StorageValue<S>;
    } catch (error: any) {
      _warn(`GET: reading error for '${key}':`, error);
      return null;
    }
  }

  setItem<S>(key: SetKey, newValue: StorageValue<S>): void {

    // do not serialize now, just store the object in the work order
    const operation = this.writeOperations[key];
    if (!operation) {
      if (DEBUG_SCHEDULER) _devWarn(`SET.${key} new operation`);
      this.writeOperations[key] = {
        queueDeadline: Date.now() + this.deadline,
        scheduledTimerId: null,
        lastState: newValue,
        needsWrite: true,
        isWriting: false,
      };
    } else {
      if (DEBUG_SCHEDULER) _devWarn(`SET.${key} updating operation`);
      if (!operation.queueDeadline)
        operation.queueDeadline = Date.now() + this.deadline;
      operation.lastState = newValue;
      operation.needsWrite = true;
    }

    // schedule the write
    this.#scheduleWrite(key);
  }

  async setItemDirect<S>(key: SetKey, newValue: StorageValue<S>): Promise<void> {
    return this.#idbWriteString(key, JSON.stringify(newValue));
  }


  // scheduling

  #scheduleWrite(key: SetKey): void {
    const operation = this.writeOperations[key];
    if (!operation) return;

    if (!operation.needsWrite) return;
    if (operation.isWriting) return;

    const now = Date.now();

    const timeUntilMerge = this.mergeWindow;
    const timeUntilDeadline = operation.queueDeadline ? operation.queueDeadline - now : 0; // 0 should not be an option, as state is set correctly
    const delay = Math.max(Math.min(timeUntilMerge, timeUntilDeadline), 0);

    if (delay > 0) {

      // schedule/reshedule the write

      if (DEBUG_SCHEDULER) _devWarn(` - schedule ${key}: ${operation.scheduledTimerId ? 'reschedule' : 'schedule'} in ${delay} ms`);
      if (operation.scheduledTimerId)
        clearTimeout(operation.scheduledTimerId);
      operation.scheduledTimerId = setTimeout(() => {
        void this.#performWrite(key);
      }, delay);

    } else {

      // we are past the deadline

      if (DEBUG_SCHEDULER) _devWarn(` - schedule ${key}: ${operation.scheduledTimerId ? 'just wait (already pending)' : 'schedule 0-delay'}`);
      if (operation.scheduledTimerId) {
        // there's already a timer scheduled, so we don't need to do anything
        return;
      }

      operation.scheduledTimerId = setTimeout(() => {
        void this.#performWrite(key);
      }, 0);
    }
  }

  async #performWrite(key: SetKey): Promise<void> {
    const operation = this.writeOperations[key];
    if (!operation) return;

    // set the state for the scheduling operations to come
    const state = operation.lastState;
    operation.queueDeadline = null;
    if (operation.scheduledTimerId) {
      clearTimeout(operation.scheduledTimerId);
      operation.scheduledTimerId = null;
    }
    operation.lastState = null;
    operation.needsWrite = false;
    operation.isWriting = true;

    try {

      // serialize
      const dateStart = Date.now();
      const serialized = JSON.stringify(state);
      if (DEBUG_SCHEDULER) _devWarn(`SET '${key}': serialized ${serialized?.length?.toLocaleString()} bytes in ${Date.now() - dateStart} ms`);

      // Optimization - ? unsure, needs testing
      // (globalThis as any)?.scheduler?.yield?.();

      // write to IDB
      await this.#idbWriteString(key, serialized);

    } catch (error: any) {
      _warn(`SET '${key}': serialization error:`, error);
    }

    // done
    operation.isWriting = false;

    // schedule the next write
    this.#scheduleWrite(key);

  }


  // with strings

  async #idbReadString(key: SetKey): Promise<string | null> {
    const now = Date.now();
    const counter = ++this.#readOpCounter;
    try {
      if (DEBUG_SCHEDULER) _devWarn(`GET ${key}(${counter})`);
      const jsonState = await idbGet(key) ?? null;
      if (DEBUG_SCHEDULER) _devWarn(jsonState === null ? `GET ${key}(${counter}) -> missing` : `GET ${key}(${counter}) -> read ${jsonState?.length?.toLocaleString()} bytes in ${Date.now() - now} ms`);
      return jsonState;
    } catch (error: any) {
      _warn(`GET '${key}(${counter})': read error:`, error);
      return null;
    }
  }

  async #idbWriteString(key: SetKey, jsonState: string): Promise<void> {
    const now = Date.now();
    const counter = ++this.#writeOpCounter;
    try {
      if (DEBUG_SCHEDULER) _devWarn(`SET ${key}(${counter})`);
      await idbSet(key, jsonState);
      if (DEBUG_SCHEDULER) _devWarn(`SET ${key}(${counter}) -> wrote ${jsonState?.length?.toLocaleString()} bytes in ${Date.now() - now} ms`);
    } catch (error: any) {
      _warn(`SET '${key}(${counter})': write error:`, error);
    }
  }


  // private fields
  #readOpCounter = 0;
  #writeOpCounter = 0;

}


const _idbScheduler = new IndexedDBWriteScheduler(IDB_MERGE_WINDOW, IDB_DEADLINE);

/**
 * Thin adapter to use the new scheduler with Zustand.
 */
export function createIDBPersistStorage<S>(): PersistStorage<S> | undefined {

  // server-side or no IDB support
  if (typeof window === 'undefined')
    return undefined;
  if (!('indexedDB' in window)) {
    _warn('[FATAL] IndexedDB is not supported in this browser.');
    return undefined;
  }

  return {
    getItem: async (name: string): Promise<StorageValue<S> | null> => _idbScheduler.getItem(name),
    setItem: (name: string, newValue: StorageValue<S>): void => _idbScheduler.setItem(name, newValue),
    removeItem: async (_name: string): Promise<void> => {
      // We do NOT remove! We don't intend to implement this, on purpose
    },
  };
}


export async function backupIdbV3(keyFrom: string, keyTo: string): Promise<boolean> {
  try {
    const existingItem = await _idbScheduler.getItem(keyFrom);
    if (existingItem === null) {
      _warn(`idbUtils: backupIdbV3: item not found: '${keyFrom}'`);
      return false;
    }
    await _idbScheduler.setItemDirect(keyTo, existingItem);
    return true;
  } catch (error) {
    _warn(`idbUtils: backupIdbV3: Error backing up from '${keyFrom}' to '${keyTo}':`, error);
    return false;
  }
}

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
await copyValue('keyval-store', 'app-chats-copy', 'app-chats');
await deleteValue('keyval-store', 'app-chats-prev');

*/
