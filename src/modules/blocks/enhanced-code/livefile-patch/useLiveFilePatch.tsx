import * as React from 'react';
import { fileOpen } from 'browser-fs-access';

import { Box, Typography } from '@mui/joy';

import { useUXLabsStore } from '~/common/state/store-ux-labs';

// Workspace
import type { DWorkspaceId } from '~/common/stores/workspace/workspace.types';
import { WorkspaceLiveFilePicker } from '~/common/stores/workspace/WorkspaceLiveFilePicker';
import { workspaceActions } from '~/common/stores/workspace/store-client-workspace';

// LiveFile
import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { isLiveFileSupported, liveFileCreateOrThrow } from '~/common/livefile/store-live-file';


export function useLiveFilePatch(title: string, code: string, isPartial: boolean, isMobile: boolean) {

  /**
   * state - Warning: very local.
   * This will get wiped just on a component remount - so it's just a temporary solution.
   */
  const [liveFileId, setLiveFileId] = React.useState<LiveFileId | null>(null);

  // external state
  const isEnabled = useUXLabsStore((state) => state.labsEnhanceCodeLiveFile && isLiveFileSupported());


  // [effect] apply the text to the LiveFile
  const processLiveFile = React.useCallback(async (liveFileId: LiveFileId) => {
    console.log('Processing LiveFile:', liveFileId);
    // const success = await liveFileWriteAndReload(id, code);
    // if (!success)
    //   setStatus({ message: 'Error writing to the file.', mtype: 'error' });
  }, []);


  // handlers

  const handleSelectLiveFile = React.useCallback(async (id: LiveFileId | null) => {
    setLiveFileId(id);
    if (id)
      await processLiveFile(id);
  }, [processLiveFile]);

  const handleSelectFileSystemFileHandle = React.useCallback(async (workspaceId: DWorkspaceId | null, fsfHandle: FileSystemFileHandle) => {
    try {
      const newId = await liveFileCreateOrThrow(fsfHandle);
      setLiveFileId(newId);

      // Attach it to the workspace
      if (workspaceId)
        workspaceActions().liveFileAssign(workspaceId, newId);
      else
        console.warn('[DEV] No workspaceId to pair the file with.');

      // proceed
      await processLiveFile(newId);
    } catch (error) {
      console.error('Error creating new file:', error);
      // setStatus({ message: `Error pairing the file: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`, mtype: 'error' });
    }
  }, [processLiveFile]);

  const handleSelectFilePicker = React.useCallback(async (workspaceId: DWorkspaceId | null) => {
    // pick a file
    const fileWithHandle = await fileOpen({ description: 'Insert into file...' }).catch(() => null /* The User closed the files picker */);
    if (!fileWithHandle)
      return;
    const fileSystemFileHandle = fileWithHandle.handle;
    if (!fileSystemFileHandle) {
      // setStatus({ message: `Browser does not support LiveFile operations. ${isLiveFileSupported() ? 'No filesystem handles.' : ''}`, mtype: 'error' });
      return;
    }
    // proceed
    await handleSelectFileSystemFileHandle(workspaceId, fileSystemFileHandle);
  }, [handleSelectFileSystemFileHandle]);


  // components

  const button = React.useMemo(() => !isEnabled ? null : (
    <Box sx={{ ml: 'auto' }}>
      <WorkspaceLiveFilePicker
        allowRemove
        autoSelectName={title}
        labelButton='Insert ...'
        labelTooltip='Apply this change to your file'
        liveFileId={liveFileId}
        onSelectFileOpen={handleSelectFilePicker}
        onSelectFileSystemFileHandle={handleSelectFileSystemFileHandle}
        onSelectLiveFile={handleSelectLiveFile}
      />
    </Box>
  ), [handleSelectLiveFile, handleSelectFilePicker, handleSelectFileSystemFileHandle, isEnabled, liveFileId, title]);

  const actionBar = React.useMemo(() => (!isEnabled || !liveFileId || true) ? null : (
    <Typography>
      {JSON.stringify(liveFileId)}
    </Typography>
  ), [liveFileId, isEnabled]);


  return {
    button,
    actionBar,
  };
}