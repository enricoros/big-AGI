import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { LiveFileId, LiveFileMetadata } from './liveFile.types';
import { checkPairingValid, useLiveFileStore } from './store-live-file';


export function useLiveFileMetadata(liveFileId: LiveFileId | undefined): LiveFileMetadata | null {
  return useLiveFileStore(useShallow((store) => !liveFileId ? null : store.getFileMetadata(liveFileId)));
}


export function useLiveFile(liveFileId: LiveFileId | null) {

  // React to changes in data
  const stableData = useLiveFileStore(useShallow((store) => {

    // Reference the file
    const file = liveFileId ? store.liveFiles[liveFileId] ?? null : null;
    if (!file) return {
      isPairingValid: false,
    };

    // Extract stable data
    const { fsHandle, ...rest } = file;
    return {
      ...rest,
      isPairingValid: checkPairingValid(file),
    };
  }));


  // Callbacks

  const closeFileContent = React.useCallback(async () => {
    if (!liveFileId) return;
    await useLiveFileStore.getState().closeFileContent(liveFileId);
  }, [liveFileId]);

  const reloadFileContent = React.useCallback(async (loadDifferentFileId?: LiveFileId) => {
    const idToLoad = loadDifferentFileId || liveFileId;
    if (idToLoad)
      await useLiveFileStore.getState().reloadFileContent(idToLoad);
  }, [liveFileId]);

  const saveFileContent = React.useCallback(async (content: string) => {
    if (!liveFileId) return false;
    return await useLiveFileStore.getState().saveFileContent(liveFileId, content);
  }, [liveFileId]);


  // Return data and methods
  const { isPairingValid, ...fileData } = stableData;
  return {
    // data
    isPairingValid,
    fileData: ('id' in fileData) ? fileData : null,

    // methods
    closeFileContent,
    reloadFileContent,
    saveFileContent,
  };
}
