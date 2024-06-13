import { isBrowser } from '~/common/util/pwaUtils';

// enable debugging of the persistent storage
const DEBUG_PERSISTENCE = false;

/**
 * Request persistent storage for the current origin, so that indexedDB's content is not evicted.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (isBrowser && navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (isPersisted) {
      if (DEBUG_PERSISTENCE)
        console.log('Storage is already persisted');
      return true;
    }

    const isGranted = await navigator.storage.persist();
    if (DEBUG_PERSISTENCE)
      console.log(`Persistent storage granted: ${isGranted}`);
    return isGranted;
  }

  console.warn('Persistent storage is not supported by this browser');
  return false;
}
