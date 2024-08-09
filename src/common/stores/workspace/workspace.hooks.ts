import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { LiveFile, LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { useLiveFileStore } from '~/common/livefile/store-live-file';

import type { DWorkspaceId } from './workspace.types';
import { useClientWorkspaceStore } from './store-client-workspace';


const stableNoMetadata: LiveFileMetadata[] = [];

export function useWorkspaceLiveFilesMetadata(workspaceId: DWorkspaceId | null): LiveFileMetadata[] {

  // stable reference to the LiveFileIds
  const workspaceLiveFileIds: LiveFileId[] | null = useClientWorkspaceStore(useShallow(state => {
    // if there's nothing for this workspace, return an empty array
    if (!workspaceId || !state.liveFilesByWorkspace[workspaceId]?.length)
      return null;

    // get an array of live file ids
    return state.liveFilesByWorkspace[workspaceId];
  }));

  // reactive stable reference to the LiveFiles
  const workspaceLiveFiles: LiveFile[] | null = useLiveFileStore(useShallow(state => {
    if (!workspaceLiveFileIds || !workspaceLiveFileIds.length)
      return null;

    return workspaceLiveFileIds.map(id => state.liveFiles[id]).filter(Boolean);
  }));

  // memoized metadata for files
  return React.useMemo(() => {
    console.log('useWorkspaceLiveFilesMetadata - rememo', workspaceLiveFiles);

    if (!workspaceLiveFiles || !workspaceLiveFiles.length)
      return stableNoMetadata;

    // otherwise return the metadata for the live files
    const { metadataGet } = useLiveFileStore.getState();
    return workspaceLiveFiles.map(lf => metadataGet(lf.id)).filter(Boolean) as LiveFileMetadata[];
  }, [workspaceLiveFiles]);
}
