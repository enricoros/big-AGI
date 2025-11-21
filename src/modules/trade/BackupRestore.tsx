import * as React from 'react';
import { fileOpen, fileSave, FileWithHandle } from 'browser-fs-access';

import { Box, Button, Checkbox, Divider, FormControl, FormLabel, Sheet, Switch, Typography } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';
import DoneIcon from '@mui/icons-material/Done';
import ErrorIcon from '@mui/icons-material/Error';
import RestoreIcon from '@mui/icons-material/Restore';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { hasKeys } from '~/common/util/objectUtils';
import { Is } from '~/common/util/pwaUtils';
import { Release } from '~/common/app.release';
import { createModuleLogger } from '~/common/logger';
import { downloadBlob } from '~/common/util/downloadUtils';

import { tradeFileVariant } from './trade.client';
import { capitalizeFirstLetter } from '~/common/util/textUtils';


// configuration
const BACKUP_FILE_FORMAT = 'Big-AGI Flash File';
const BACKUP_FORMAT_VERSION = '1.2';
const BACKUP_FORMAT_VERSION_NUMBER = 102000;
const WINDOW_RELOAD_DELAY = 300;
const EXCLUDED_LOCAL_STORAGE_KEYS = [
  'agi-logger-log', // the log cannot be restored as it's in-mem and being persisted while this is running
];
const EXCLUDED_IDB_DATABASES = [
  'Big-AGI', // exclude DBlobs IDB
];
const INCLUDED_IDB_KEYS: { [dbName: string]: { [storeName: string]: string[]; }; } = {
  'keyval-store': { 'keyval': ['app-chats'] }, // include ONLY the chats IDB
};


// Flashing Backup Schema
// NOTE: ABSOLUTELY NOT CHANGE WITHOUT CHANGING THE saveFlashObjectOrThrow_Streaming TOO (!)
interface DFlashSchema {
  schema: 'vnd.agi.flash-backup';
  schemaVersion: number;
  tenantSlug: string; // mirrors Release.TenantSlug
  metadata: {
    version: string;
    timestamp: string;
    application: string;
    backupType: 'full' | 'partial' | 'auto-before-restore';
  };
  storage: {
    localStorage: Record<string, any>;
    indexedDB?: Record<string, any>; // DBName -> StoreName -> { key: any, value: any }[] - optional for settings-only backups
  };
}


// -- Utility Functions --

const logger = createModuleLogger('client', 'flash');

function _getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}


// -- LocalStorage Read --

async function getAllLocalStorageKeyValues(): Promise<Record<string, any>> {
  const data: Record<string, any> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || EXCLUDED_LOCAL_STORAGE_KEYS.includes(key)) continue;
      try {
        const value = localStorage.getItem(key);
        if (value !== null) {
          try {
            data[key] = JSON.parse(value);
          } catch {
            data[key] = value; // Store as string if not valid JSON
          }
        }
      } catch (error) {
        console.error(`Error reading localStorage key "${key}":`, error);
      }
    }
  } catch (error) {
    console.error('Error accessing localStorage:', error);
    // return what we have
  }
  return data;
}


// -- IndexedDB Read --

async function getAllIndexedDBData(ignoreExclusions: boolean): Promise<Record<string, any>> {
  const data: Record<string, any> = {};
  try {
    const dbNames = await listIndexedDBDatabaseNames();
    for (const dbName of dbNames) {
      if (!ignoreExclusions && EXCLUDED_IDB_DATABASES.includes(dbName)) continue;
      try {
        data[dbName] = await getIndexedDBContent(dbName);
      } catch (error) {
        console.error(`Error getting content for IndexedDB "${dbName}":`, error);
      }
    }
  } catch (error) {
    console.error('Error processing IndexedDB databases:', error);
    // return what we have
  }
  return data;
}

async function listIndexedDBDatabaseNames(): Promise<string[]> {
  try {
    // use the modern API to list all
    if ('databases' in indexedDB) {
      const dbs = await window.indexedDB.databases() as IDBDatabaseInfo[];
      return dbs.map(db => db.name || '').filter(Boolean);
    }

    // fallback: try-open (and close right away) known names
    const existingDbs: string[] = [];
    for (const dbName of ['keyval-store']) {
      try {
        const idb = window.indexedDB;
        const request = idb.open(dbName);
        await new Promise<void>((resolve) => {
          request.onblocked = () => resolve();
          request.onerror = () => resolve(); // not an error for us
          request.onsuccess = () => {
            request.result.close();
            existingDbs.push(dbName);
            resolve();
          };
        });
      } catch {
      }
    }

    return existingDbs;
  } catch (error) {
    logger.error('Error listing IndexedDB databases:', error);
    return [];
  }
}

function getIndexedDBContent(dbName: string): Promise<Record<string, { key: any; value: any }[]>> {
  return new Promise((resolve, reject) => {
    let dbRequest: IDBOpenDBRequest | null = null;

    // set a 5 seconds timeout to prevent hanging on open if it never does
    const timeout = setTimeout(() => {
      if (dbRequest) {
        try {
          // Try to abort the request if possible
          if ('abort' in dbRequest) {
            (dbRequest as any).abort();
          }
        } catch {
        }
        reject(new Error(`Timeout opening IndexedDB "${dbName}"`));
      }
    }, 5000); // 5 second timeout

    try {
      dbRequest = window.indexedDB.open(dbName);

      dbRequest.onerror = (event) => {
        clearTimeout(timeout);
        const target = event.target as IDBRequest;
        const errorMsg = target.error ? target.error.message : 'Unknown error';
        reject(new Error(`Failed to open IndexedDB "${dbName}": ${errorMsg}`));
      };

      dbRequest.onsuccess = (event) => {
        clearTimeout(timeout);
        const db = (event.target as IDBOpenDBRequest).result;
        const storeNames = Array.from(db.objectStoreNames);
        const dbData: Record<string, { key: any; value: any }[]> = {};

        if (storeNames.length === 0) {
          db.close();
          resolve(dbData);
          return;
        }

        let transactionError = false;
        const transaction = db.transaction(storeNames, 'readonly');

        transaction.onerror = (event) => {
          transactionError = true;
          const target = event.target as IDBTransaction;
          const errorMsg = target.error ? target.error.message : 'Unknown error';
          logger.error(`transaction error in "${dbName}": ${errorMsg}`);
          // Don't reject - we'll resolve with partial data at completion
        };

        transaction.oncomplete = () => {
          db.close();
          if (transactionError)
            logger.warn(`transaction for "${dbName}" completed with some errors. Data may be incomplete.`);
          resolve(dbData);
        };

        storeNames.forEach(storeName => {
          dbData[storeName] = [];
          try {
            const store = transaction.objectStore(storeName);
            const keyInclusionList = INCLUDED_IDB_KEYS[dbName]?.[storeName] ?? undefined;
            const hasInclusionFilters = !!keyInclusionList && keyInclusionList.length > 0;

            store.openCursor().onsuccess = (event) => {
              const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
              if (cursor) {
                // convert key to string for matching if needed
                const keyAsString = typeof cursor.key === 'string' ? cursor.key : cursor.key !== null ? String(cursor.key) : null;

                // if no inclusion filters include everything, otherwise include only keys that include the pattern
                const shouldInclude = !hasInclusionFilters || (keyAsString && keyInclusionList!.some(pattern => keyAsString.includes(pattern)));
                if (shouldInclude)
                  dbData[storeName].push({ key: cursor.key, value: cursor.value });
                try {
                  cursor.continue();
                } catch (error) {
                  logger.error(`Error continuing cursor for store "${storeName}":`, error);
                  // Can't continue but we have some data
                }
              }
            };
          } catch (error) {
            logger.error(`Error processing store "${storeName}":`, error);
            // Continue with other stores
          }
        });
      };
    } catch (error) {
      clearTimeout(timeout);
      reject(new Error(`Error setting up IndexedDB request for "${dbName}": ${_getErrorText(error)}`));
    }
  });
}


// --- Data Restore Functions ---

async function restoreLocalStorage(data: Record<string, any>): Promise<void> {
  try {
    // Skip restoration if backup contains no localStorage data
    if (!hasKeys(data)) {
      logger.info('Skipping localStorage restore - backup contains no localStorage data');
      return;
    }

    localStorage.clear();
    for (const key in data) {
      try {
        const value = data[key];
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      } catch (error) {
        logger.error(`Error restoring localStorage key "${key}":`, error);
      }
    }
  } catch (error) {
    throw new Error(`Failed to restore localStorage: ${_getErrorText(error)}`);
  }
}

async function restoreIndexedDB(allDbData: Record<string, any>): Promise<void> {
  // expected local DBs to restore over, from the latest `main` (was: `v2-dev`, 2025-05-14)
  const dbTargetVersions: { [dbName: string]: number } = {
    'keyval-store': 1,
    'Big-AGI': 10, // Dexie multiplied the version (1) by 10 (https://github.com/dexie/Dexie.js/issues/59)
  };

  // process each database in sequence
  for (const dbName in allDbData) {
    try {
      const dbStoresData = allDbData[dbName] as Record<string, { key: any; value: any }[]>;
      const dbStoreNames = Object.keys(dbStoresData);
      const dbStoreVersion = dbTargetVersions[dbName] || 1;

      await new Promise<void>((resolve, reject) => {
        try {
          const openRequest = window.indexedDB.open(dbName, dbStoreVersion);

          // If the DB was not there, it means we're loading the flash over the new architecture (ZYNC). In this case, we need to recreate
          // the stores inside this new DB first.
          openRequest.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            logger.debug(`onupgradeneeded triggered for DB "${dbName}" (oldVersion: ${event.oldVersion}, newVersion: ${event.newVersion})`);

            // Create object stores based on the database name
            if (dbName === 'keyval-store') {
              // Create the keyval object store if it doesn't exist
              if (!db.objectStoreNames.contains('keyval')) {
                db.createObjectStore('keyval');
                logger.info(`Created keyval object store in keyval-store database`);
              }
            } else if (dbName === 'Big-AGI') {
              // Create the largeAssets object store with all its indices if it doesn't exist
              if (!db.objectStoreNames.contains('largeAssets')) {
                const largeAssetsStore = db.createObjectStore('largeAssets', { keyPath: 'id' });
                // Create all the indices as defined in dblobs.db.ts
                // Index common properties (and compound indexes)
                largeAssetsStore.createIndex('[contextId+scopeId]', ['contextId', 'scopeId']);
                largeAssetsStore.createIndex('assetType', 'assetType');
                largeAssetsStore.createIndex('[assetType+contextId+scopeId]', ['assetType', 'contextId', 'scopeId']);
                largeAssetsStore.createIndex('data.mimeType', 'data.mimeType');
                largeAssetsStore.createIndex('origin.ot', 'origin.ot');
                largeAssetsStore.createIndex('origin.source', 'origin.source');
                largeAssetsStore.createIndex('createdAt', 'createdAt');
                largeAssetsStore.createIndex('updatedAt', 'updatedAt');
                logger.info(`Created largeAssets object store with all indices in Big-AGI database`);
              }
            } else {
              // For any unknown database, try to create the object stores that are in the backup
              for (const storeName of dbStoreNames) {
                if (!db.objectStoreNames.contains(storeName)) {
                  logger.warn(`Creating object store "${storeName}" in unknown DB "${dbName}" without schema`);
                  try {
                    db.createObjectStore(storeName);
                  } catch (error) {
                    logger.error(`Failed to create object store "${storeName}" in DB "${dbName}":`, error);
                  }
                }
              }
            }
          };

          openRequest.onerror = (event) => {
            const target = event.target as IDBOpenDBRequest;
            const errorMsg = target.error ? target.error.message : 'Unknown error';
            reject(new Error(`Failed to open "${dbName}": ${errorMsg}`));
          };

          openRequest.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const existingStoreNames = Array.from(db.objectStoreNames);
            const storesToRestore = dbStoreNames.filter(name => existingStoreNames.includes(name));

            if (storesToRestore.length < dbStoreNames.length)
              logger.error(`No matching stores found in ${dbName}, expected '${dbStoreNames.join(', ')}' but found '${existingStoreNames.join(', ')}'`);
            if (storesToRestore.length === 0) {
              db.close();
              resolve();
              return;
            }

            // Create a transaction to clear and then restore each store
            try {
              const transaction = db.transaction(storesToRestore, 'readwrite');
              let transactionFailed = false;

              transaction.onerror = (event) => {
                transactionFailed = true;
                const target = event.target as IDBTransaction;
                const errorMsg = target.error ? target.error.message : 'Unknown error';
                logger.error(`Transaction error during restore of "${dbName}": ${errorMsg}`);
                // Don't reject - we'll resolve at completion
              };

              transaction.oncomplete = () => {
                db.close();
                if (transactionFailed) {
                  logger.warn(`Transaction for "${dbName}" completed with some errors. Restore may be incomplete.`);
                } else {
                  logger.warn(`Successfully restored database: ${dbName}`);
                }
                resolve();
              };

              // Process each store sequentially
              let completedStores = 0;
              const processNextStore = (storeIndex: number) => {
                if (storeIndex >= storesToRestore.length) return;

                const storeName = storesToRestore[storeIndex];
                const store = transaction.objectStore(storeName);
                const items = dbStoresData[storeName] || [];

                // 1. Clear the store
                const clearRequest = store.clear();
                clearRequest.onsuccess = () => {
                  // logger.debug(`Cleared store "${storeName}" in "${dbName}"`);

                  // 2. Add all items back
                  let itemsProcessed = 0;

                  // Add each item from the backup
                  items.forEach(item => {
                    try {
                      // Handle possible cases:
                      // 1. Store with keyPath - add value directly
                      // 2. Store without keyPath - add value with explicit key
                      let request: IDBRequest;

                      // Special handling for keyval-store which has no keyPath
                      if (dbName === 'keyval-store' && storeName === 'keyval') {
                        request = store.add(item.value, item.key);
                      } else if (store.keyPath !== null) {
                        // Store has a keyPath, add value directly
                        request = store.add(item.value);
                      } else {
                        // Store has no keyPath, add with explicit key
                        request = store.add(item.value, item.key);
                      }

                      request.onsuccess = () => {
                        itemsProcessed++;
                        if (itemsProcessed === items.length) {
                          logger.info(`Restored ${items.length} items to store "${storeName}" in "${dbName}"`);
                          completedStores++;

                          // Process next store
                          processNextStore(storeIndex + 1);
                        }
                      };

                      request.onerror = (event) => {
                        const error = (event.target as IDBRequest).error;
                        logger.error(`Error adding item to "${storeName}" in "${dbName}" (Key: ${
                          typeof item.key === 'object' ? JSON.stringify(item.key) : item.key
                        }): ${error?.message || 'Unknown error'}`);

                        itemsProcessed++;
                        if (itemsProcessed === items.length) {
                          logger.warn(`Restored ${items.length} items to store "${storeName}" with some errors`);
                          completedStores++;

                          // Process next store
                          processNextStore(storeIndex + 1);
                        }
                      };
                    } catch (error) {
                      logger.error(`Error processing item in "${storeName}": ${_getErrorText(error)}`);
                      itemsProcessed++;
                      if (itemsProcessed === items.length) {
                        processNextStore(storeIndex + 1);
                      }
                    }
                  });

                  // Handle empty store case
                  if (items.length === 0) {
                    logger.warn(`No items to restore for store "${storeName}"`);
                    completedStores++;
                    processNextStore(storeIndex + 1);
                  }
                };

                clearRequest.onerror = (event) => {
                  logger.error(`Error clearing store "${storeName}": ${(event.target as IDBRequest).error?.message || 'Unknown error'}`);
                  // Try to continue anyway
                  completedStores++;
                  processNextStore(storeIndex + 1);
                };
              };

              // Start processing the first store
              processNextStore(0);
            } catch (error) {
              db.close();
              reject(new Error(`Error setting up transaction for "${dbName}": ${_getErrorText(error)}`));
            }
          };

          openRequest.onblocked = () => {
            logger.warn(`Open request for "${dbName}" is blocked, but continuing anyway`);
            // Let onsuccess or onerror handle it
          };
        } catch (error) {
          reject(new Error(`Error setting up database open request for "${dbName}": ${_getErrorText(error)}`));
        }
      });

      // logger.log(`Completed restore process for: ${dbName}`);
    } catch (error) {
      logger.error(`Error restoring database "${dbName}": ${_getErrorText(error)}`);
      // Continue with other databases even if one fails
    }
  }
}

// --- Validation and Utility Functions ---

function isValidBackup(data: any): data is DFlashSchema {
  return !!(
    data &&
    typeof data === 'object' &&
    data.metadata &&
    typeof data.metadata === 'object' &&
    typeof data.metadata.version === 'string' &&
    typeof data.metadata.timestamp === 'string' &&
    typeof data.metadata.application === 'string' &&
    data.storage &&
    typeof data.storage === 'object' &&
    typeof data.storage.localStorage === 'object' &&
    // indexedDB is optional (can be empty {} for settings-only backups)
    (data.storage.indexedDB === undefined || typeof data.storage.indexedDB === 'object')
  );
}

/**
 * Creates a backup object and optionally saves it to a file
 */
async function saveFlashObjectOrThrow(backupType: 'full' | 'auto-before-restore', forceDownloadOverFileSave: boolean, ignoreExclusions: boolean, includeSettings: boolean, includeIndexedDB: boolean, saveToFileName: string) {

  // for mobile, try with the download link approach - we keep getting truncated JSON save-files in other paths, streaming or not
  if (forceDownloadOverFileSave || !Is.Desktop)
    return createFlashObject(backupType, ignoreExclusions, includeSettings, includeIndexedDB)
      .then(JSON.stringify)
      .then((flashString) => {
        logger.info(`Expected flash file size: ${flashString.length.toLocaleString()} bytes`);
        downloadBlob(new Blob([flashString], { type: 'application/json' }), saveToFileName);
        return undefined;
      });

  // for mobile, try a different implementation, with streaming creation, to hopefully avoid truncation
  // if (forceStreaming || !Is.Desktop)
  //   return saveFlashObjectOrThrow_Streaming(backupType, ignoreExclusions, saveToFileName);

  // run after the file picker has confirmed a file
  const flashBlobPromise = new Promise<Blob>(async (resolve) => {
    // create the backup object (heavy operation)
    const flashObject = await createFlashObject(backupType, ignoreExclusions, includeSettings, includeIndexedDB);

    // WARNING: on Mobile, the JSON serialization could fail silently - we disable pretty-print to conserve space
    const flashString = !Is.Desktop ? JSON.stringify(flashObject)
      : JSON.stringify(flashObject, null, 2);

    logger.info(`Expected flash file size: ${flashString.length.toLocaleString()} bytes`);

    resolve(new Blob([flashString], { type: 'application/json' }));
  });

  return await fileSave(flashBlobPromise, {
    description: BACKUP_FILE_FORMAT,
    extensions: ['.agi.json', '.json'],
    fileName: saveToFileName,
  });
}

// async function saveFlashObjectOrThrow_Streaming(backupType: 'full' | 'auto-before-restore', ignoreExclusions: boolean, saveToFileName: string) {
//
//   // on mobile, stringify without spaces
//   const spacesForMobile = Is.Desktop ? 2 : undefined;
//
//   // create JSON in chunks without ever holding the entire string in memory
//   const encoder = new TextEncoder();
//
//   // create a streaming response - this is the key to avoiding truncation
//   const response = new Response(
//     new ReadableStream({
//       async start(controller) {
//         try {
//           // start the JSON object
//           controller.enqueue(encoder.encode('{\n'));
//           controller.enqueue(encoder.encode(`  "schema": "vnd.agi.flash-backup",\n`));
//           controller.enqueue(encoder.encode(`  "schemaVersion": ${BACKUP_FORMAT_VERSION_NUMBER},\n`));
//           controller.enqueue(encoder.encode(`  "metadata": ${JSON.stringify({
//             version: BACKUP_FORMAT_VERSION,
//             timestamp: new Date().toISOString(),
//             application: 'Big-AGI',
//             backupType,
//           }, null, spacesForMobile).replace(/^/gm, '  ')},\n`));
//
//           // stream storage section
//           controller.enqueue(encoder.encode('  "storage": {\n'));
//
//           // add localStorage (usually smaller)
//           const localStorage = await getAllLocalStorageKeyValues();
//           controller.enqueue(encoder.encode('    "localStorage": '));
//           controller.enqueue(encoder.encode(JSON.stringify(localStorage, null, spacesForMobile).replace(/^/gm, '    ')));
//           controller.enqueue(encoder.encode(',\n'));
//
//           // add indexedDB with manual chunking for large objects
//           controller.enqueue(encoder.encode('    "indexedDB": {\n'));
//
//           const indexedDB = await getAllIndexedDBData(ignoreExclusions);
//           const dbNames = Object.keys(indexedDB);
//           for (let i = 0; i < dbNames.length; i++) {
//             const dbName = dbNames[i];
//             const isLast = i === dbNames.length - 1;
//
//             controller.enqueue(encoder.encode(`      "${dbName}": `));
//
//             // clean nulls and control characters
//             const sanitized = JSON.stringify(indexedDB[dbName], (_key, value) => {
//               if (typeof value === 'string')
//                 return value.replace(/\u0000/g, '');
//               return value;
//             }, spacesForMobile).replace(/^/gm, '      ');
//
//             controller.enqueue(encoder.encode(sanitized));
//             controller.enqueue(encoder.encode(isLast ? '\n' : ',\n'));
//           }
//
//           // close all objects
//           controller.enqueue(encoder.encode('    }\n'));
//           controller.enqueue(encoder.encode('  }\n'));
//           controller.enqueue(encoder.encode('}\n'));
//
//           controller.close();
//         } catch (error) {
//           console.error('Error creating stream:', error);
//           controller.error(error);
//         }
//       },
//     }),
//     {
//       headers: {
//         'Content-Type': 'application/json',
//         'Content-Disposition': `attachment; filename="${saveToFileName}"`,
//       },
//     },
//   );
//
//   // the fileSave implementation will use the body.pipeTo(writable) code path
//   // which is perfect for large files as it streams directly to disk
//   await fileSave(response, {
//     description: BACKUP_FILE_FORMAT,
//     extensions: ['.agi.json', '.json'],
//     fileName: saveToFileName,
//   });
// }

async function createFlashObject(backupType: 'full' | 'auto-before-restore', ignoreExclusions: boolean, includeSettings: boolean, includeIndexedDB: boolean): Promise<DFlashSchema> {
  return {
    schema: 'vnd.agi.flash-backup',
    schemaVersion: BACKUP_FORMAT_VERSION_NUMBER,
    tenantSlug: Release.TenantSlug,
    metadata: {
      version: BACKUP_FORMAT_VERSION,
      timestamp: new Date().toISOString(),
      application: 'Big-AGI',
      backupType,
    },
    storage: {
      localStorage: includeSettings ? await getAllLocalStorageKeyValues() : {},
      indexedDB: includeIndexedDB ? await getAllIndexedDBData(ignoreExclusions) : {},
    },
  };
}


/**
 * Backup and Restore (Flashing) functionality for Big-AGI client-side data.
 * Saves and fully restores localStorage and IndexedDB data.
 */
export function FlashRestore(props: { unlockRestore?: boolean }) {

  // state
  const [restoreState, setRestoreState] = React.useState<'idle' | 'processing' | 'confirm' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [backupDataForRestore, setBackupDataForRestore] = React.useState<DFlashSchema | null>(null);
  const [restoreLocalStorageEnabled, setRestoreLocalStorageEnabled] = React.useState(false);
  const [restoreIndexedDBEnabled, setRestoreIndexedDBEnabled] = React.useState(false);
  const [schemaVersionWarning, setSchemaVersionWarning] = React.useState<string | null>(null);
  const [tenantSlugWarning, setTenantSlugWarning] = React.useState<string | null>(null);

  // derived state
  const isUnlocked = !!props.unlockRestore;
  const isBusy = restoreState === 'processing';
  const hasLocalStorageData = backupDataForRestore ? hasKeys(backupDataForRestore.storage.localStorage) : false;
  const hasIndexedDBData = backupDataForRestore ? hasKeys(backupDataForRestore.storage.indexedDB) : false;


  // handlers

  const handleRestoreLoad = React.useCallback(async () => {
    setBackupDataForRestore(null);
    setRestoreState('idle');
    setErrorMessage(null);
    setSchemaVersionWarning(null);
    setTenantSlugWarning(null);

    // user selects a file
    let file: FileWithHandle;
    try {
      file = await fileOpen({
        extensions: ['.agi.json', '.json'],
        description: BACKUP_FILE_FORMAT,
        mimeTypes: ['application/json'],
      });
    } catch (error: any) {
      // handle an error saving
      if (error?.name !== 'AbortError') {
        setRestoreState('error');
        setErrorMessage(`Restore failed: ${_getErrorText(error)}`);
      }
      return;
    }

    try {
      setRestoreState('processing');
      const content = await file.text();
      let data;
      try {
        data = JSON.parse(content);
      } catch (error) {
        // User selected invalid JSON - this is expected, not a system error
        setRestoreState('error');
        setErrorMessage(`Invalid JSON in Flash file: ${_getErrorText(error)}`);
        logger.warn('User selected non-JSON file for restore', { error }, undefined, { skipReporting: true });
        return;
      }

      // validations
      if (!isValidBackup(data)) {
        // User selected wrong file format - this is expected, not a system error
        setRestoreState('error');
        setErrorMessage(`Invalid Flash file format. This does not appear to be a valid ${BACKUP_FILE_FORMAT}.`);
        logger.warn('User selected invalid backup file format', { data: { hasMetadata: !!data?.metadata, hasStorage: !!data?.storage } }, undefined, { skipReporting: true });
        return;
      }
      if (data.metadata.application !== 'Big-AGI') {
        // User selected incompatible file - this is expected, not a system error
        setRestoreState('error');
        setErrorMessage(`Incompatible Flash file. Found application "${data.metadata.application}" but expected "Big-AGI".`);
        logger.warn('User selected incompatible backup file', { application: data.metadata.application }, undefined, { skipReporting: true });
        return;
      }

      // Check for schema version downgrade
      const currentSchemaVersion = BACKUP_FORMAT_VERSION_NUMBER;
      const backupSchemaVersion = data.schemaVersion || 0;
      if (backupSchemaVersion > currentSchemaVersion)
        setSchemaVersionWarning(`WARNING: You are restoring from an newer Big-AGI version to this one. This is a DOWNGRADE and may cause data loss or application errors.`);
      else {
        // Check for tenant slug mismatch
        const currentTenantSlug = Release.TenantSlug;
        const backupTenantSlug = data.tenantSlug || 'unknown';
        if (backupTenantSlug !== currentTenantSlug)
          setTenantSlugWarning(`WARNING: Backup was not performed from this installation (${capitalizeFirstLetter(currentTenantSlug)}). This may cause compatibility issues.`);
      }

      // load data purely into state, and ready for confirmation
      setBackupDataForRestore(data);
      setRestoreState('confirm');
      // Reset checkboxes to OFF by default for safety
      setRestoreLocalStorageEnabled(false);
      setRestoreIndexedDBEnabled(false);
    } catch (error: any) {
      // Unexpected system errors only
      logger.error('Unexpected error during restore preparation:', error);
      setRestoreState('error');
      setErrorMessage(`Restore failed: ${_getErrorText(error)}`);
    }
  }, []);

  const handleRestoreFlashConfirmed = React.useCallback(async () => {
    if (!backupDataForRestore) return;
    setRestoreState('processing');
    setErrorMessage(null);
    try {
      // 1. Auto-backup current state (best effort)
      // NOTE: disabled: more confusing/harmful than useful
      // try {
      //   const dateStr = new Date().toISOString().split('.')[0].replace('T', '-');
      //   await saveFlashObjectOrThrow(
      //     'auto-before-restore',
      //     true, // auto-backup with streaming
      //     false, // auto-backup without images
      //     `Big-AGI-auto-pre-flash-${dateStr}.json`,
      //   );
      //   logger.info('Created auto-backup before restore');
      // } catch (error: any) {
      //   if (error?.name === 'AbortError')
      //     logger.warn('Auto-backup before restore dismissed by the user');
      //   else
      //     logger.warn('Auto-backup before restore failed:', error);
      //   // non-fatal, proceed with restore
      // }

      // 2. Restore data based on user selections
      if (restoreLocalStorageEnabled) {
        await restoreLocalStorage(backupDataForRestore.storage.localStorage);
        logger.info('localStorage restore complete');
      }
      if (restoreIndexedDBEnabled) {
        await restoreIndexedDB(backupDataForRestore.storage.indexedDB || {});
        logger.info('indexedDB restore complete');
      }

      // Check if nothing was selected
      if (!restoreLocalStorageEnabled && !restoreIndexedDBEnabled) {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error('No data was selected for restore. Please select at least one option.');
      }

      // 3. Close the modal cleanly first to prevent React DOM errors during unmount
      // Set state to idle and clear backup data to trigger modal close
      setRestoreState('success');

      // 3. Alert and reload - Close modal first, then wait for storage flush and DOM cleanup
      setBackupDataForRestore(null);

      // 4. Wait for React to complete the modal unmount and storage to flush
      setTimeout(() => {
        alert('Backup restored successfully.\n\nThe application will now reload to apply the changes.');
        window.location.reload();
      }, WINDOW_RELOAD_DELAY); // 300ms allows modal to unmount and storage to flush

    } catch (error: any) {
      logger.error('Restore operation failed:', error);
      setRestoreState('error');
      setErrorMessage(`Restore failed: ${_getErrorText(error)}`);
      setBackupDataForRestore(null);
    }
  }, [backupDataForRestore, restoreIndexedDBEnabled, restoreLocalStorageEnabled]);

  const handleCancelRestore = React.useCallback(() => {
    setRestoreState('idle');
    setBackupDataForRestore(null);
  }, []);

  return <>

    <Typography level='body-sm' mt={2}>
      Restore a full installation:
    </Typography>
    <Button
      variant='soft'
      aria-label='Restore from flash file'
      color={restoreState === 'success' ? 'success' : restoreState === 'error' ? 'danger' : 'primary'}
      disabled={isBusy || !isUnlocked}
      loading={restoreState === 'processing'}
      endDecorator={restoreState === 'success' ? <DoneIcon /> : restoreState === 'error' ? <ErrorIcon /> : <RestoreIcon />}
      onClick={handleRestoreLoad}
      sx={{
        boxShadow: 'md',
        backgroundColor: 'background.popup',
        justifyContent: 'space-between',
      }}
    >
      {restoreState === 'success' ? 'Restore Complete' : restoreState === 'error' ? 'Restore Failed' : restoreState === 'processing' ? 'Restoring...' : 'Re-Flash from File'}
    </Button>
    {/*{!errorMessage && <Typography level='body-xs'>*/}
    {/*  Warning: Replaces current data.<br />Requires page reload.*/}
    {/*</Typography>}*/}

    {/* Error Display */}
    {errorMessage && (
      <Sheet variant='soft' color='danger' sx={{ px: 1.5, py: 1, borderRadius: 'sm', display: 'grid', gap: 1 }}>
        <Typography color='danger' level='body-sm'>
          {errorMessage}
        </Typography>
        <Button variant='soft' color='danger' size='sm' onClick={() => setErrorMessage(null)}>
          Dismiss
        </Button>
      </Sheet>
    )}

    {/* Confirmation Dialog */}
    <GoodModal
      title={`Confirm Restore`}
      strongerTitle
      dividers
      hideBottomClose
      open={restoreState === 'confirm'}
      onClose={handleCancelRestore}
    >
      <Typography textColor='text.secondary'>
        This will <Typography fontWeight='lg' color='danger'>replace all current application data</Typography> with the content from the selected flash file.&nbsp;
        <Typography fontWeight='lg' color='danger'>WARNING: This is a destructive operation that may break the app.</Typography>
      </Typography>
      {/*<Typography fontWeight='md'>*/}
      {/*  An automatic backup of your current data will be attempted before proceeding.*/}
      {/*</Typography>*/}
      {backupDataForRestore?.metadata && (
        <Box sx={{ mt: 1, p: 1.5, bgcolor: 'background.level1', borderRadius: 'sm', border: '1px solid', borderColor: 'neutral.outlinedBorder', fontSize: 'sm' }}>
          <Box fontWeight='md' mb={1}>Flash File Details:</Box>
          <Divider sx={{ my: 1 }} />
          Created: {new Date(backupDataForRestore.metadata.timestamp).toLocaleString()}<br />
          Backup Type: {backupDataForRestore.metadata.backupType}<br />
          Version: {backupDataForRestore.metadata.version}<br />
          Schema Version: {backupDataForRestore.schemaVersion || 'unknown'}<br />
          Tenant: {backupDataForRestore.tenantSlug || 'unknown'}<br />
          <Divider sx={{ my: 1 }} />
          Full Databases: {Object.keys(backupDataForRestore.storage.indexedDB || {}).length}<br />
          Setting Groups: {Object.keys(backupDataForRestore.storage.localStorage).length}<br />
        </Box>
      )}
      {/* Schema Version Warning */}
      {schemaVersionWarning && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'danger.softBg', borderRadius: 'sm', border: '2px solid', borderColor: 'danger.outlinedBorder' }}>
          <Typography level='body-sm' color='danger' fontWeight='lg' startDecorator={<WarningRoundedIcon />}>
            {schemaVersionWarning}
          </Typography>
        </Box>
      )}
      {/* Tenant Slug Warning */}
      {tenantSlugWarning && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'danger.softBg', borderRadius: 'sm', border: '2px solid', borderColor: 'danger.outlinedBorder' }}>
          <Typography level='body-sm' color='danger' fontWeight='lg' startDecorator={<WarningRoundedIcon />}>
            {tenantSlugWarning}
          </Typography>
        </Box>
      )}
      <Box sx={{ mt: 2 }}>
        <Typography level='body-sm' sx={{ mb: 1 }} color={!restoreLocalStorageEnabled && !restoreIndexedDBEnabled ? 'danger' : undefined}>
          Select what to restore:
        </Typography>
        <Sheet variant='soft' sx={{ p: 2, borderRadius: 'md', border: '1px solid', borderColor: 'neutral.outlinedBorder', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
          <FormControl orientation='horizontal' sx={{ gap: 1, flex: 1 }}>
            <Checkbox
              size='md'
              color='neutral'
              checked={restoreLocalStorageEnabled}
              disabled={!hasLocalStorageData}
              onChange={(event) => setRestoreLocalStorageEnabled(event.target.checked)}
            />
            <FormLabel sx={{ fontWeight: 'sm', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', opacity: hasLocalStorageData ? 1 : 0.5 }}>
              App Settings
              <Typography level='body-xs' sx={{ fontWeight: 'normal', color: 'text.secondary' }}>
                {hasLocalStorageData ? '(preferences, models)' : '(not in backup file)'}
              </Typography>
            </FormLabel>
          </FormControl>
          <FormControl orientation='horizontal' sx={{ gap: 1, flex: 1 }}>
            <Checkbox
              size='md'
              color='neutral'
              checked={restoreIndexedDBEnabled}
              disabled={!hasIndexedDBData}
              onChange={(event) => setRestoreIndexedDBEnabled(event.target.checked)}
            />
            <FormLabel sx={{ fontWeight: 'sm', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', opacity: hasIndexedDBData ? 1 : 0.5 }}>
              Conversations
              <Typography level='body-xs' sx={{ fontWeight: 'normal', color: 'text.secondary' }}>
                {hasIndexedDBData ? '(chats, attachments)' : '(not in backup file)'}
              </Typography>
            </FormLabel>
          </FormControl>
        </Sheet>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
        <Button variant='plain' color='neutral' onClick={handleCancelRestore}>
          Cancel
        </Button>
        <Button
          variant='solid'
          color='danger'
          onClick={handleRestoreFlashConfirmed}
          loading={restoreState === 'processing'}
          disabled={!restoreLocalStorageEnabled && !restoreIndexedDBEnabled}
        >
          Replace Selected Data
        </Button>
      </Box>
    </GoodModal>

  </>;
}


export function FlashBackup(props: {
  onStartedBackup?: () => void;
}) {

  // state
  const [includeImages, setIncludeImages] = React.useState(false);
  const [includeSettings, setIncludeSettings] = React.useState(true);
  const [backupState, setBackupState] = React.useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // derived state
  const { onStartedBackup } = props;
  const isProcessing = backupState === 'processing';

  // handlers

  const handleFullBackup = React.useCallback(async (event: React.MouseEvent) => {
    setBackupState('processing');
    setErrorMessage(null);
    try {
      onStartedBackup?.();
      const dateStr = new Date().toISOString().split('.')[0].replace('T', '-');
      const success = await saveFlashObjectOrThrow(
        'full',
        event.ctrlKey, // control forces a traditional browser download - default: fileSave
        includeImages,
        includeSettings,
        true, // includeIndexedDB - full backup includes everything
        `Big-AGI-${tradeFileVariant()}-flash${includeImages ? '+images' : ''}${includeSettings ? '' : '-nosets'}${event.ctrlKey ? '-download' : ''}-${dateStr}.json`,
      );
      setBackupState(success ? 'success' : 'idle');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // the user has closed the file picker, most likely - do nothing
        setBackupState('idle');
      } else {
        logger.error(`Backup failed:`, error);
        setBackupState('error');
        setErrorMessage(`Backup failed: ${_getErrorText(error)}`);
      }
    }
  }, [includeImages, includeSettings, onStartedBackup]);


  return <>

    <Typography level='body-sm' mt={3}>
      Save <strong>all settings and chats</strong>:
    </Typography>
    <Button
      variant='soft'
      aria-label='Download full flash file'
      color={backupState === 'success' ? 'success' : backupState === 'error' ? 'warning' : 'primary'}
      disabled={isProcessing}
      loading={isProcessing}
      endDecorator={backupState === 'success' ? <DoneIcon /> : backupState === 'error' ? <ErrorIcon /> : <DownloadIcon />}
      onClick={handleFullBackup}
      onDoubleClick={console.log}
      sx={{
        boxShadow: 'md',
        backgroundColor: 'background.popup',
        justifyContent: 'space-between',
      }}
    >
      {backupState === 'success' ? 'Backup Saved' : backupState === 'error' ? 'Backup Failed' : isProcessing ? 'Backing Up...' : 'Export All'}
    </Button>
    {!errorMessage && <>
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', ml: 2, mr: 1.25, mt: 0.25 }}>
        <FormLabel sx={{ fontWeight: 'md' }}>Include Models & Settings</FormLabel>
        <Switch size='sm' checked={includeSettings} onChange={(event) => setIncludeSettings(event.target.checked)} />
      </FormControl>
      <FormControl orientation='horizontal' sx={{ justifyContent: 'space-between', alignItems: 'center', ml: 2, mr: 1.25, mt: 0.25 }}>
        <FormLabel sx={{ fontWeight: 'md' }}>Include Binary Images</FormLabel>
        <Switch size='sm' color={includeImages ? 'danger' : undefined} checked={includeImages} onChange={(event) => setIncludeImages(event.target.checked)} />
      </FormControl>
      {includeImages && <Typography level='body-xs' color='danger' ml={2} endDecorator={<WarningRoundedIcon />}>
        Files too large may get corrupted.
      </Typography>}
    </>}

    {errorMessage && (
      <Sheet variant='soft' color='danger' sx={{ px: 1.5, py: 1, borderRadius: 'sm', display: 'grid', gap: 1 }}>
        <Typography color='danger' level='body-sm'>
          {errorMessage}
        </Typography>
        <Button variant='soft' color='danger' size='sm' onClick={() => setErrorMessage(null)}>
          Dismiss
        </Button>
      </Sheet>
    )}

  </>;
}
