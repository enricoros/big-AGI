import { isBrowser } from '~/common/util/pwaUtils';

// enable debugging of the persistent storage
const DEBUG_PERSISTENCE = false;

// track if persistent storage has been granted already
let _alreadyGranted = false;

/**
 * Request persistent storage for the current origin, so that indexedDB's content is not evicted.
 */
export async function requestPersistentStorageSafe(): Promise<boolean> {
  // if already granted in this session, return true immediately
  if (_alreadyGranted)
    return true;

  try {
    if (isBrowser && navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (isPersisted) {
        if (DEBUG_PERSISTENCE)
          console.log('Storage is already persisted', await estimatePersistentStorageOrThrow());
        _alreadyGranted = true;
        return true;
      }

      const isGranted = await navigator.storage.persist();
      if (DEBUG_PERSISTENCE || !isGranted) {
        // await navigator.storage.getDirectory()
        const estimate = await estimatePersistentStorageOrThrow();
        console.log('Persistent storage granted:', isGranted, 'usageMB:', estimate?.usageMB, 'quotaMB:', estimate?.quotaMB);
      }
      if (isGranted)
        _alreadyGranted = true;
      return isGranted;
    }
  } catch (error) {
    console.error('Error requesting persistent storage', error);
    return false;
  }

  console.warn('Persistent storage is not supported by this browser');
  return false;
}

export async function estimatePersistentStorageOrThrow(): Promise<{ usageMB: number, quotaMB: number } | null> {
  if (isBrowser && navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      // convert to MBs (with 3 decimal places)
      usageMB: Math.round((estimate.usage || 0) / 1024 / 1024 * 1000) / 1000,
      quotaMB: Math.round((estimate.quota || 0) / 1024 / 1024),
    };
  }

  console.warn('Storage estimate is not supported by this browser');
  return null;
}
