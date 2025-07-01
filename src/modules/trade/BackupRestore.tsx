// noinspection ExceptionCaughtLocallyJS

import * as React from 'react';
import { fileOpen, fileSave, FileWithHandle } from 'browser-fs-access';

import { Box, Button, Divider, FormControl, FormLabel, Sheet, Switch, Typography } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';
import DoneIcon from '@mui/icons-material/Done';
import ErrorIcon from '@mui/icons-material/Error';
import RestoreIcon from '@mui/icons-material/Restore';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { Is } from '~/common/util/pwaUtils';
import { Release } from '~/common/app.release';
import { createModuleLogger } from '~/common/logger';
import { downloadBlob } from '~/common/util/downloadUtils';


// configuration
const BACKUP_FILE_FORMAT = 'Big-AGI Flash File';
const BACKUP_FORMAT_VERSION = '1.2';
const BACKUP_FORMAT_VERSION_NUMBER = 102000;
const WINDOW_RELOAD_DELAY = 200;
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
  _t: 'agi.flash-backup';
  _v: number;
  metadata: {
    version: string;
    timestamp: string;
    application: string;
    backupType: 'full' | 'partial' | 'auto-before-restore';
  };
  storage: {
    localStorage: Record<string, any>;
    indexedDB: Record<string, any>; // DBName -> StoreName -> { key: any, value: any }[]
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
  // expected local DBs to restore over, from the latest `v2-dev` (2025-05-14)
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
            logger.info(`onupgradeneeded triggered for DB "${dbName}" (oldVersion: ${event.oldVersion}, newVersion: ${event.newVersion})`);

            for (const storeName of dbStoreNames) {
              if (!db.objectStoreNames.contains(storeName)) {
                logger.info(`Creating missing object store "${storeName}" in DB "${dbName}"`);

                if (dbName === 'keyval-store' && storeName === 'keyval') {
                  // v2-dev-style key-value store for the chats cell
                  db.createObjectStore(storeName);
                  logger.info(`Created keyval object store in keyval-store database`);
                } else if (dbName === 'Big-AGI' && storeName === 'largeAssets') {
                  // v2-dev-style Blobs store
                  const largeAssetsStore = db.createObjectStore(storeName, { keyPath: 'id' });
                  largeAssetsStore.createIndex('contextId+scopeId', ['contextId', 'scopeId']);
                  largeAssetsStore.createIndex('assetType', 'assetType');
                  largeAssetsStore.createIndex('assetType+contextId+scopeId', ['assetType', 'contextId', 'scopeId']);
                  largeAssetsStore.createIndex('data.mimeType', 'data.mimeType');
                  largeAssetsStore.createIndex('origin.ot', 'origin.ot');
                  largeAssetsStore.createIndex('origin.source', 'origin.source');
                  largeAssetsStore.createIndex('createdAt', 'createdAt');
                  largeAssetsStore.createIndex('updatedAt', 'updatedAt');
                  logger.info(`Created largeAssets object store with all needed indexes in Big-AGI database`);
                } else {
                  logger.warn(`Cannot automatically create object store "${storeName}" in DB "${dbName}" as its schema is unknown.`);
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
                  logger.info(`Successfully restored database: ${dbName}`);
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
                      const request = store.keyPath !== null
                        ? store.add(item.value)
                        : store.add(item.value, item.key);

                      request.onsuccess = () => {
                        itemsProcessed++;
                        if (itemsProcessed === items.length) {
                          // logger.debug(`Restored ${items.length} items to store "${storeName}"`);
                          completedStores++;

                          // Process next store
                          processNextStore(storeIndex + 1);
                        }
                      };

                      request.onerror = (event) => {
                        logger.error(`Error adding item to "${storeName}" in "${dbName}" (Key: ${
                          typeof item.key === 'object' ? JSON.stringify(item.key) : item.key
                        }): ${(event.target as IDBRequest).error?.message || 'Unknown error'}`);

                        itemsProcessed++;
                        if (itemsProcessed === items.length) {
                          // logger.debug(`Restored ${items.length} items to store "${storeName}" with some errors`);
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
    typeof data.storage.indexedDB === 'object'
  );
}

/**
 * Creates a backup object and optionally saves it to a file
 */
async function saveFlashObjectOrThrow(backupType: 'full' | 'auto-before-restore', forceDownloadOverFileSave: boolean, ignoreExclusions: boolean, saveToFileName: string) {

  // for mobile, try with the download link approach - we keep getting truncated JSON save-files in other paths, streaming or not
  if (forceDownloadOverFileSave || !Is.Desktop)
    return createFlashObject(backupType, ignoreExclusions)
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
    const flashObject = await createFlashObject(backupType, ignoreExclusions);

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
//           controller.enqueue(encoder.encode(`  "_t": "agi.flash-backup",\n`));
//           controller.enqueue(encoder.encode(`  "_v": ${BACKUP_FORMAT_VERSION_NUMBER},\n`));
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

async function createFlashObject(backupType: 'full' | 'auto-before-restore', ignoreExclusions: boolean): Promise<DFlashSchema> {
  return {
    _t: 'agi.flash-backup',
    _v: BACKUP_FORMAT_VERSION_NUMBER,
    metadata: {
      version: BACKUP_FORMAT_VERSION,
      timestamp: new Date().toISOString(),
      application: 'Big-AGI',
      backupType,
    },
    storage: {
      localStorage: await getAllLocalStorageKeyValues(),
      indexedDB: await getAllIndexedDBData(ignoreExclusions),
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

  // derived state
  const isUnlocked = !!props.unlockRestore;
  const isBusy = restoreState === 'processing';


  // handlers

  const handleRestoreLoad = React.useCallback(async () => {
    setBackupDataForRestore(null);
    setRestoreState('idle');
    setErrorMessage(null);

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
        throw new Error(`Restore failed: Invalid JSON in Flash file: ${_getErrorText(error)}`);
      }

      // validations
      if (!isValidBackup(data))
        throw new Error(`Invalid Flash file format. This does not appear to be a valid ${BACKUP_FILE_FORMAT}.`);
      if (data.metadata.application !== 'Big-AGI' || !data.storage.indexedDB || !data.storage.localStorage)
        throw new Error(`Incompatible Flash file. Found application "${data.metadata.application}" but expected "Big-AGI".`);

      // load data purely into state, and ready for confirmation
      setBackupDataForRestore(data);
      setRestoreState('confirm');
    } catch (error: any) {
      logger.error('Restore preparation failed:', error);
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

      // 2. Restore data (localStorage first, then IndexedDB)
      await restoreLocalStorage(backupDataForRestore.storage.localStorage);
      logger.info('localStorage restore complete');
      await restoreIndexedDB(backupDataForRestore.storage.indexedDB);
      logger.info('indexedDB restore complete');
      setRestoreState('success');

      // 3. Alert and reload
      setTimeout(() => {
        alert('Backup restored successfully.\n\nThe application will now reload to apply the changes.');
        window.location.reload();
      }, WINDOW_RELOAD_DELAY);

    } catch (error: any) {
      logger.error('Restore operation failed:', error);
      setRestoreState('error');
      setErrorMessage(`Restore failed: ${_getErrorText(error)}`);
    } finally {
      setBackupDataForRestore(null);
    }
  }, [backupDataForRestore]);

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
      title={`Confirm ${Release.App.versionName} Restore`}
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
          <Divider sx={{ my: 1 }} />
          Full Databases: {Object.keys(backupDataForRestore.storage.indexedDB).length}<br />
          Setting Groups: {Object.keys(backupDataForRestore.storage.localStorage).length}<br />
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
        <Button variant='plain' color='neutral' onClick={handleCancelRestore}>
          Cancel
        </Button>
        <Button variant='solid' color='danger' onClick={handleRestoreFlashConfirmed} loading={restoreState === 'processing'}>
          Replace & Reset All Data
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
        `Big-AGI-flash${includeImages ? '+images' : ''}${event.ctrlKey ? '-download' : ''}-${dateStr}.json`,
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
  }, [includeImages, onStartedBackup]);


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
