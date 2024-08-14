import * as React from 'react';
import { fileOpen } from 'browser-fs-access';
import { Box, ColorPaletteProp, Sheet } from '@mui/joy';

import { useUXLabsStore } from '~/common/state/store-ux-labs';

// Workspace
import type { DWorkspaceId } from '~/common/stores/workspace/workspace.types';
import { WorkspaceLiveFilePicker } from '~/common/stores/workspace/WorkspaceLiveFilePicker';
import { workspaceActions } from '~/common/stores/workspace/store-client-workspace';

// LiveFile
import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { isLiveFileSupported, liveFileCreateOrThrow, useLiveFileStore } from '~/common/livefile/store-live-file';
import { liveFileSheetSx } from '~/common/livefile/livefile.theme';


interface FileOperationStatus {
  message: React.ReactNode;
  mtype: 'info' | 'changes' | 'success' | 'error';
}


export function useLiveFilePatch(title: string, code: string, isPartial: boolean, isMobile: boolean) {

  /**
   * state - Warning: very local.
   * This will get wiped just on a component remount - so it's just a temporary solution.
   */
  const [liveFileId, setLiveFileId] = React.useState<LiveFileId | null>(null);
  const [status, setStatus] = React.useState<FileOperationStatus | null>(null);

  // external state
  const isEnabled = useUXLabsStore((state) => state.labsEnhanceCodeLiveFile && isLiveFileSupported());

  const { contentReloadFromDisk, contentWriteAndReload } = useLiveFileStore();

  const processLiveFile = React.useCallback(async (fileId: LiveFileId) => {
    setStatus({ message: 'Processing file...', mtype: 'info' });

    try {
      // Step 1: Load the latest version of the file
      await contentReloadFromDisk(fileId);
      const srcFile = useLiveFileStore.getState().liveFiles[fileId];

      // Step 2: Generate patch (to be implemented)
      // const patch = await generatePatch(srcFile.content!, code);

      // Step 3: Apply patch and check if it succeeds (to be implemented)
      // const newContent = applyPatch(srcFile.content!, patch);

      // For now, we'll just use the new code directly
      const newContent = code;

      // Step 4: Success - user can decide to proceed
      setStatus({ message: 'Patch generated successfully. Ready to apply.', mtype: 'success' });

      // You can add a confirmation step here before writing to the file
      const shouldWrite = window.confirm('Patch generated successfully. Do you want to apply it to the file?');
      if (shouldWrite) {
        setStatus({ message: 'Applying patch...', mtype: 'info' });
        const writeSuccess = await contentWriteAndReload(fileId, newContent);
        if (!writeSuccess) {
          throw new Error('Failed to write to file');
        }
        setStatus({ message: 'Patch applied successfully.', mtype: 'success' });
      }
    } catch (error) {
      setStatus({
        message: `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
        mtype: 'error',
      });
    }
  }, [code, contentReloadFromDisk, contentWriteAndReload]);

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
      setStatus({
        message: `Error pairing the file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        mtype: 'error',
      });
    }
  }, [processLiveFile]);

  const handleSelectFilePicker = React.useCallback(async (workspaceId: DWorkspaceId | null) => {
    // pick a file
    const fileWithHandle = await fileOpen({ description: 'Insert into file...' }).catch(() => null /* The User closed the files picker */);
    if (!fileWithHandle)
      return;
    const fileSystemFileHandle = fileWithHandle.handle;
    if (!fileSystemFileHandle)
      return setStatus({
        message: `Browser does not support LiveFile operations. ${isLiveFileSupported() ? 'No filesystem handles.' : ''}`,
        mtype: 'error',
      });
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

  const actionBar = React.useMemo(() => {

    if (!isEnabled || !liveFileId || !status)
      return null;

    const isError = status?.mtype === 'error';

    const statusColor: ColorPaletteProp =
      isError ? 'warning'
        : status?.mtype === 'success' ? 'success'
          : status?.mtype === 'changes' ? 'neutral'
            : 'neutral';


    return (
      <Sheet color={statusColor} sx={liveFileSheetSx}>

        {status.message}

      </Sheet>
    );
  }, [isEnabled, liveFileId, status]);

  return {
    button,
    actionBar,
  };
}