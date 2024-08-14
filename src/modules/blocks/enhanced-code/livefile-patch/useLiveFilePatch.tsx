import * as React from 'react';
import { fileOpen } from 'browser-fs-access';

import { Box, Button, Typography } from '@mui/joy';

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


  // handlers

  const handleSelectLiveFile = React.useCallback((id: LiveFileId | null) => {
    setLiveFileId(id);
  }, []);

  const handleSelectFileSystemFileHandle = React.useCallback(async (workspaceId: DWorkspaceId | null, fsfHandle: FileSystemFileHandle) => {
    // Create a new LiveFile and attach it to the workspace
    try {
      const newLiveFileId = await liveFileCreateOrThrow(fsfHandle);
      setLiveFileId(newLiveFileId);

      // Pair the file with the workspace
      if (!workspaceId)
        console.warn('[DEV] No workspaceId to pair the file with.');
      else
        workspaceActions().liveFileAssign(workspaceId, newLiveFileId);

      // TODO: Implement file content writing logic here
      // For example:
      // await liveFileContentWriteAndReload(code);

    } catch (error) {
      console.error('Error creating new file:', error);
      // setStatus({ message: `Error pairing the file: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`, mtype: 'error' });
    }
  }, []);

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
    <Box sx={{
      ml: 'auto',
      display: 'flex',
      alignItems: 'center',
      gap: 0, // otherwise the button icon seems far
    }}>

      {/* Patch LiveFile */}
      {!!liveFileId && (
        <Button
          variant='plain'
          color='neutral'
          size='sm'
          onClick={() => setLiveFileId(null)}
        >
          TODO - TEST
        </Button>
      )}

      {/* Pick LiveFile */}
      <WorkspaceLiveFilePicker
        autoSelectName={title}
        labelButton='Insert...'
        labelTooltip='Insert this code into a file'
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