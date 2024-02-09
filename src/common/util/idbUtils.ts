import type { StateStorage } from 'zustand/middleware';
import { del as idbDel, get as idbGet, set as idbSet } from 'idb-keyval';

// used by the state storage middleware to detect data migration from the old state storage (localStorage)
// NOTE: remove past 2024-03-19 (6 months past release of this utility conversion)
export const IDB_MIGRATION_INITIAL = -1;


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