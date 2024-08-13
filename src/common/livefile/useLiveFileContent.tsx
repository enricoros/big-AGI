import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { LiveFileId } from './liveFile.types';
import { checkPairingValid, useLiveFileStore } from './store-live-file';


export function useLiveFileContent(liveFileId: LiveFileId | null) {

  // React to changes in data
  const stableData = useLiveFileStore(useShallow((store) => {

    // Reference the file
    const liveFile = liveFileId ? store.liveFiles[liveFileId] ?? null : null;
    if (!liveFile) return {
      isPairingValid: false,
    };

    // Extract stable data
    const { fsHandle, ...rest } = liveFile;
    return {
      ...rest,
      isPairingValid: checkPairingValid(liveFile),
    };
  }));


  // Callbacks

  const liveFileContentClose = React.useCallback(async () => {
    if (!liveFileId) return;
    await useLiveFileStore.getState().contentClose(liveFileId);
  }, [liveFileId]);

  const liveFileContentReloadFromDisk = React.useCallback(async (loadDifferentFileId?: LiveFileId) => {
    const idToLoad = loadDifferentFileId || liveFileId;
    if (idToLoad)
      await useLiveFileStore.getState().contentReloadFromDisk(idToLoad);
  }, [liveFileId]);

  const liveFileContentWriteAndReload = React.useCallback(async (content: string) => {
    if (!liveFileId) return false;
    return await useLiveFileStore.getState().contentWriteAndReload(liveFileId, content);
  }, [liveFileId]);


  // Return data and methods
  const { isPairingValid, ...fileData } = stableData;
  return {
    // data
    isPairingValid,
    fileData: ('id' in fileData) ? fileData : null,

    // methods
    liveFileContentClose,
    liveFileContentReloadFromDisk,
    liveFileContentWriteAndReload,
  };
}
