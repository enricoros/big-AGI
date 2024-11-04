import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { LiveFile, LiveFileId, LiveFileMetadata } from '~/common/livefile/liveFile.types';
import { useLiveFileStore } from '~/common/livefile/store-live-file';

import type { DWorkspaceId } from './workspace.types';
import { useClientWorkspaceStore } from './store-client-workspace';


export interface WorkspaceContents {
  workspaceId: DWorkspaceId | null;
  liveFilesMetadata: LiveFileMetadata[];
}

export function useWorkspaceContentsMetadata(workspaceId: DWorkspaceId | null): WorkspaceContents {

  // stable reference to the LiveFileIds
  const workspaceLiveFileIds: LiveFileId[] | null = useClientWorkspaceStore(useShallow(state => {
    if (!workspaceId) return null;

    // as we only have LiveFiles, stop if we don't have any
    if (!state.liveFilesByWorkspace[workspaceId]?.length)
      return null;

    // re-renders if the array changes at all
    return state.liveFilesByWorkspace[workspaceId].toReversed();
  }));

  // reactive stable reference to the Workspace (only) LiveFiles
  // stability note: exposes on any liveFileStore change, but only re-renders if any Workspace LiveFile changes or is added/removed
  const workspaceLiveFiles: LiveFile[] | null = useLiveFileStore(useShallow(state => {
    if (!workspaceLiveFileIds?.length) return null;

    // re-render if any LiveFile changes, is added or removed
    return workspaceLiveFileIds.map(id => state.liveFiles[id]).filter(Boolean);
  }));

  // re-renders (returns a new object) every time a dependency changes
  return React.useMemo(() => {
    // NOTE: we could go further and stabilize individual LiveFileMetadata objects, to improve re-renders

    // creation of the workspace contents (stabilized thought the memo inputs)
    const { metadataGet } = useLiveFileStore.getState();
    const liveFilesMetadata = (workspaceLiveFiles || []).map(lf => metadataGet(lf.id)).filter(Boolean) as LiveFileMetadata[];
    return {
      workspaceId,
      liveFilesMetadata,
    };
  }, [workspaceId, workspaceLiveFiles]);
}
