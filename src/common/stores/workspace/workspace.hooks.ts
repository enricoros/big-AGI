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

// const stableWorkspace: WorkspaceContents = {
//   liveFilesMetadata: [],
// };

export function useWorkspaceContents(workspaceId: DWorkspaceId | null): WorkspaceContents | null {

  // stable reference to the LiveFileIds
  // - w/out useShallow as updates to the array contents are real
  const workspaceLiveFileIds: LiveFileId[] | null = useClientWorkspaceStore(state =>
    (!workspaceId || !state.liveFilesByWorkspace[workspaceId]?.length) ? null
      : state.liveFilesByWorkspace[workspaceId],
  );

  // reactive stable reference to the LiveFiles
  // - with useShallow as map recreates the array every time
  const workspaceLiveFiles: LiveFile[] | null = useLiveFileStore(useShallow(state =>
    !workspaceLiveFileIds?.length ? null
      : workspaceLiveFileIds.map(id => state.liveFiles[id]).filter(Boolean),
  ));

  return React.useMemo(() => {
    // stable out
    // if (!workspaceLiveFiles || !workspaceLiveFiles.length)
    //   return null; // stableWorkspace;
    console.log('workspaceLiveFileIds', { workspaceId, workspaceLiveFiles });

    // creation of the woekspace contents (stabilized thought the memo inputs)
    const { metadataGet } = useLiveFileStore.getState();
    const liveFilesMetadata = (workspaceLiveFiles || []).map(lf => metadataGet(lf.id)).filter(Boolean) as LiveFileMetadata[];
    return {
      workspaceId: workspaceId!,
      liveFilesMetadata,
    };
  }, [workspaceId, workspaceLiveFiles]);
}
