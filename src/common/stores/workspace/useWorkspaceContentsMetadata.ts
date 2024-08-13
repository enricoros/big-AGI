import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { LiveFile, LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { useLiveFileStore } from '~/common/livefile/store-live-file';

import type { DWorkspaceId } from './workspace.types';
import { useClientWorkspaceStore } from './store-client-workspace';


export interface WorkspaceContents {
  workspaceId: DWorkspaceId;
  liveFilesMetadata: LiveFileMetadata[];
}

export function useWorkspaceContentsMetadata(workspaceId: DWorkspaceId | null): WorkspaceContents {

  // stable reference to the LiveFileIds
  // - w/out useShallow as updates to the array contents are real
  const workspaceLiveFileIds: LiveFileId[] | null = useClientWorkspaceStore(state => {
    if (!workspaceId) return null;

    // as we only have LiveFiles, stop if we don't have any
    if (!state.liveFilesByWorkspace[workspaceId]?.length)
      return null;

    // re-renders if the array changes at all
    return state.liveFilesByWorkspace[workspaceId].toReversed();
  });

  // reactive stable reference to the LiveFiles
  // - with useShallow as map recreates the array every time
  const workspaceLiveFiles: LiveFile[] | null = useLiveFileStore(useShallow(state => {
    // stop if we are not referencing any LiveFiles
    if (!workspaceLiveFileIds?.length)
      return null;

    // re-render if any LiveFile changes, is added or removed
    // upcast liveFile.id -> liveFile, skipping missing, with a stable array check
    return workspaceLiveFileIds.map(id => state.liveFiles[id]).filter(Boolean);
  }));

  // re-renders (returns a new object) every time a dependency changes
  return React.useMemo(() => {
    // creation of the woekspace contents (stabilized thought the memo inputs)
    const { metadataGet } = useLiveFileStore.getState();
    const liveFilesMetadata = (workspaceLiveFiles || []).map(lf => metadataGet(lf.id)).filter(Boolean) as LiveFileMetadata[];
    return {
      workspaceId: workspaceId!,
      liveFilesMetadata,
    };
  }, [workspaceId, workspaceLiveFiles]);
}
