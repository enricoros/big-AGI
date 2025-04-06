// noinspection ExceptionCaughtLocallyJS

import * as React from 'react';
import { fileOpen, fileSave, FileWithHandle } from 'browser-fs-access';

import { Box, Button, Divider, Sheet, Typography } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';
import DoneIcon from '@mui/icons-material/Done';
import ErrorIcon from '@mui/icons-material/Error';
import RestoreIcon from '@mui/icons-material/Restore';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { Release } from '~/common/app.release';
import { logger } from '~/common/logger';


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
        console.error(`backup-restore: Error reading localStorage key "${key}":`, error);
      }
    }
  } catch (error) {
    console.error('backup-restore: Error accessing localStorage:', error);
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
        console.error(`backup-restore: Error getting content for IndexedDB "${dbName}":`, error);
      }
    }
  } catch (error) {
    console.error('backup-restore: Error processing IndexedDB databases:', error);
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
    console.error('backup-restore: Error listing IndexedDB databases:', error);
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
          logger.error(`backup-restore: transaction error in "${dbName}": ${errorMsg}`);
          // Don't reject - we'll resolve with partial data at completion
        };

        transaction.oncomplete = () => {
          db.close();
          if (transactionError)
            logger.warn(`backup-restore: transaction for "${dbName}" completed with some errors. Data may be incomplete.`);
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
                  logger.error(`backup-restore: Error continuing cursor for store "${storeName}":`, error);
                  // Can't continue but we have some data
                }
              }
            };
          } catch (error) {
            logger.error(`backup-restore: Error processing store "${storeName}":`, error);
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
        console.error(`Error restoring localStorage key "${key}":`, error);
      }
    }
  } catch (error) {
    throw new Error(`Failed to restore localStorage: ${_getErrorText(error)}`);
  }
}

async function restoreIndexedDB(allDbData: Record<string, any>): Promise<void> {
  // process each database in sequence
  for (const dbName in allDbData) {
    try {
      console.log(`Starting restore for database: ${dbName}`);
      const dbStoresData = allDbData[dbName] as Record<string, { key: any; value: any }[]>;

      await new Promise<void>((resolve, reject) => {
        try {
          const openRequest = window.indexedDB.open(dbName);

          openRequest.onerror = (event) => {
            const target = event.target as IDBOpenDBRequest;
            const errorMsg = target.error ? target.error.message : 'Unknown error';
            reject(new Error(`Failed to open "${dbName}": ${errorMsg}`));
          };

          openRequest.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const existingStoreNames = Array.from(db.objectStoreNames);
            const storesToRestore = Object.keys(dbStoresData)
              .filter(name => existingStoreNames.includes(name));

            if (storesToRestore.length === 0) {
              console.log(`No matching stores found in ${dbName}, skipping`);
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
                console.error(`Transaction error during restore of "${dbName}": ${errorMsg}`);
                // Don't reject - we'll resolve at completion
              };

              transaction.oncomplete = () => {
                db.close();
                if (transactionFailed) {
                  console.warn(`Transaction for "${dbName}" completed with some errors. Restore may be incomplete.`);
                } else {
                  console.log(`Successfully restored database: ${dbName}`);
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
                  console.log(`Cleared store "${storeName}" in "${dbName}"`);

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
                          console.log(`Restored ${items.length} items to store "${storeName}"`);
                          completedStores++;

                          // Process next store
                          processNextStore(storeIndex + 1);
                        }
                      };

                      request.onerror = (event) => {
                        console.error(`Error adding item to "${storeName}" in "${dbName}" (Key: ${
                          typeof item.key === 'object' ? JSON.stringify(item.key) : item.key
                        }): ${(event.target as IDBRequest).error?.message || 'Unknown error'}`);

                        itemsProcessed++;
                        if (itemsProcessed === items.length) {
                          console.log(`Restored ${items.length} items to store "${storeName}" with some errors`);
                          completedStores++;

                          // Process next store
                          processNextStore(storeIndex + 1);
                        }
                      };
                    } catch (error) {
                      console.error(`Error processing item in "${storeName}": ${_getErrorText(error)}`);
                      itemsProcessed++;
                      if (itemsProcessed === items.length) {
                        processNextStore(storeIndex + 1);
                      }
                    }
                  });

                  // Handle empty store case
                  if (items.length === 0) {
                    console.log(`No items to restore for store "${storeName}"`);
                    completedStores++;
                    processNextStore(storeIndex + 1);
                  }
                };

                clearRequest.onerror = (event) => {
                  console.error(`Error clearing store "${storeName}": ${(event.target as IDBRequest).error?.message || 'Unknown error'}`);
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
            console.warn(`Open request for "${dbName}" is blocked, but continuing anyway`);
            // Let onsuccess or onerror handle it
          };
        } catch (error) {
          reject(new Error(`Error setting up database open request for "${dbName}": ${_getErrorText(error)}`));
        }
      });

      console.log(`Completed restore process for: ${dbName}`);
    } catch (error) {
      console.error(`Error restoring database "${dbName}": ${_getErrorText(error)}`);
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
async function createBackupAndSaveToOrThrow(backupType: 'full' | 'auto-before-restore', ignoreExclusions: boolean, saveToFileName?: string): Promise<DFlashSchema> {

  const flashObject: DFlashSchema = {
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

  if (saveToFileName) {
    const backupBlob = new Blob([JSON.stringify(flashObject, null, 2)], { type: 'application/json' });
    await fileSave(backupBlob, {
      fileName: saveToFileName,
      extensions: ['.json'],
      description: 'Big-AGI V2 Flash File',
    });
  }

  return flashObject;
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
        extensions: ['.json'],
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
      console.error('Restore preparation failed:', error);
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
      try {
        const dateStr = new Date().toISOString().split('.')[0].replace('T', '-');
        await createBackupAndSaveToOrThrow('auto-before-restore', false, `Big-AGI-auto-pre-flash-${dateStr}.agi.json`);
        logger.info('backup-restore: Created auto-backup before restore');
      } catch (error) {
        logger.warn('backup-restore: Auto-backup before restore failed:', error);
        // non-fatal, proceed with restore
      }

      // 2. Restore data (localStorage first, then IndexedDB)
      await restoreLocalStorage(backupDataForRestore.storage.localStorage);
      logger.info('backup-restore: localStorage restore complete');
      await restoreIndexedDB(backupDataForRestore.storage.indexedDB);
      logger.info('backup-restore: indexedDB restore complete');
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
      <Typography fontWeight='md'>
        An automatic backup of your current data will be attempted before proceeding.
      </Typography>
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
      await createBackupAndSaveToOrThrow('full', event.shiftKey, `Big-AGI-flash${event.shiftKey ? '+images' : ''}-${dateStr}.agi.json`);
      setBackupState('success');
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        // the user has closed the file picker, most likely - do nothing
        setBackupState('idle');
      } else {
        logger.error(`backup-restore: Backup failed:`, error);
        setBackupState('error');
        setErrorMessage(`Backup failed: ${_getErrorText(error)}`);
      }
    }
  }, [onStartedBackup]);


  return <>

    <Typography level='body-sm' mt={5}>
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
      sx={{
        boxShadow: 'md',
        backgroundColor: 'background.popup',
        justifyContent: 'space-between',
      }}
    >
      {backupState === 'success' ? 'Backup Saved' : backupState === 'error' ? 'Backup Failed' : isProcessing ? 'Backing Up...' : 'Export All'}
    </Button>
    {!errorMessage && <Typography level='body-xs'>
      Shift + Click to include images
    </Typography>}

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
