import * as React from 'react';
import { fileOpen } from 'browser-fs-access';
import { Box, Button, ColorPaletteProp, Sheet } from '@mui/joy';

import { useUXLabsStore } from '~/common/state/store-ux-labs';

// Workspace
import type { DWorkspaceId } from '~/common/stores/workspace/workspace.types';
import { WorkspaceLiveFilePicker } from '~/common/stores/workspace/WorkspaceLiveFilePicker';
import { workspaceActions } from '~/common/stores/workspace/store-client-workspace';

// LiveFile
import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { isLiveFileSupported, liveFileCreateOrThrow } from '~/common/livefile/store-live-file';
import { liveFileSheetSx } from '~/common/livefile/livefile.theme';
import { usePatchingWorkflow } from '~/modules/blocks/enhanced-code/livefile-patch/usePatchingWorkflow';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';


export function useLiveFilePatch(title: string, code: string, isPartial: boolean, isMobile: boolean) {

  /**
   * state - Warning: very local.
   * This will get wiped just on a component remount - so it's just a temporary solution.
   */
  const [liveFileId, setLiveFileId] = React.useState<LiveFileId | null>(null);

  // external state
  const isEnabled = useUXLabsStore((state) => state.labsEnhanceCodeLiveFile && isLiveFileSupported());


  const { status, patchState, targetOverwriteWithPatch } = usePatchingWorkflow(liveFileId, code);

  // const processLiveFile = React.useCallback(async (fileId: LiveFileId) => {
  //   // reset state
  //   // setStatus({ message: 'Processing...', mtype: 'info' });
  //   // setPatchState({ srcContent: null, patchContent: null, newContent: null });
  //
  //   try {
  //
  //     // Step 1: Load the latest version of the file
  //     const srcContent = await targetReloadFromDisk();
  //     if (!srcContent)
  //       return;
  //
  //     // Step 2: Generate patch
  //     const patchContent = await targetGeneratePatch(srcContent, code);
  //     if (!patchContent)
  //       return;
  //
  //     // Step 3: Apply patch and check if it succeeds
  //     await targetApplyPatch(srcContent, patchContent);
  //
  //     // Step 4: Success - user can decide to proceed
  //     // setStatus({ message: 'Patch generated and applied successfully. Ready to save.', mtype: 'success' });
  //
  //   } catch (error) {
  //     // setStatus({
  //     //   message: `Error: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
  //     //   mtype: 'error',
  //     // });
  //   }
  // }, [code, targetApplyPatch, targetGeneratePatch, targetReloadFromDisk]);

  // const handleSavePatch = React.useCallback(async () => {
  //   if (!liveFileId || !patchState.newContent) return;
  //
  //   setStatus({ message: 'Saving changes to file...', mtype: 'info' });
  //   try {
  //     const writeSuccess = await contentWriteAndReload(liveFileId, patchState.newContent);
  //     if (!writeSuccess) {
  //       throw new Error('Failed to write to file');
  //     }
  //     setStatus({ message: 'Changes saved successfully.', mtype: 'success' });
  //   } catch (error) {
  //     setStatus({
  //       message: `Error saving changes: ${error instanceof Error ? error.message : 'An unknown error occurred'}`,
  //       mtype: 'error',
  //     });
  //   }
  // }, [liveFileId, patchState.newContent, contentWriteAndReload]);

  const handleSelectLiveFile = React.useCallback(async (id: LiveFileId | null) => {
    setLiveFileId(id);
    // if (id) {
    //   await processLiveFile(id);
    // }
  }, []);

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
      // await processLiveFile(newId);
    } catch (error) {
      console.error('Error creating new file:', error);
      // setStatus({
      //   message: `Error pairing the file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      //   mtype: 'error',
      // });
    }
  }, []);

  const handleSelectFilePicker = React.useCallback(async (workspaceId: DWorkspaceId | null) => {
    // pick a file
    const fileWithHandle = await fileOpen({ description: 'Insert into file...' }).catch(() => null /* The User closed the files picker */);
    if (!fileWithHandle)
      return;
    const fileSystemFileHandle = fileWithHandle.handle;
    if (!fileSystemFileHandle) {
      // setStatus({
      //   message: `Browser does not support LiveFile operations. ${isLiveFileSupported() ? 'No filesystem handles.' : ''}`,
      //   mtype: 'error',
      // });
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
        labelButton='Apply ...'
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
        : status?.mtype === 'success' ? 'neutral'
          : 'neutral';

    return (
      <Sheet color={statusColor} sx={liveFileSheetSx}>

        {status.message}

        {/*<Chip variant='soft' color='primary'>*/}
        {/*  loaded*/}
        {/*</Chip>*/}

        {/*<Chip variant='solid' color='primary'>*/}
        {/*  applying ...*/}
        {/*</Chip>*/}

        {/*<Button*/}
        {/*  variant='soft'*/}
        {/*  color='primary'*/}
        {/*  size='sm'*/}
        {/*  // disabled={isLoadingFile /* commented to not make this flash *!/*/}
        {/*  // onClick={handleLoadFromDisk}*/}
        {/*  // aria-label='Load content from disk'*/}
        {/*>*/}
        {/*  loaded*/}
        {/*</Button>*/}


        {status.mtype === 'success' && patchState.newContent && (
          <Box sx={{ display: 'flex', gap: 1 }}>

            <Button
              color='success'
              size='sm'
              variant='outlined'
              onClick={targetOverwriteWithPatch}
              sx={{
                // backgroundColor: 'red', // doesn't show?
                boxShadow: 'xs',
              }}
            >
              Overwrite File
            </Button>

            <TooltipOutlined title='Not yet available'>
              <Button
                disabled
                color='neutral'
                variant='soft'
                size='sm'
              >
                Patch File
              </Button>
            </TooltipOutlined>

            {/*<Button onClick={() => processLiveFile(liveFileId)} color='neutral' size='sm'>*/}
            {/*  Regenerate Patch*/}
            {/*</Button>*/}

          </Box>
        )}

      </Sheet>
    );
  }, [isEnabled, liveFileId, patchState.newContent, status, targetOverwriteWithPatch]);

  return {
    button,
    actionBar,
  };
}
