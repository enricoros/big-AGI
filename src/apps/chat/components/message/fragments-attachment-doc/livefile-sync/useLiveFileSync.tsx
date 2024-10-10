import * as React from 'react';
import { diffLines } from 'diff';
import { fileOpen } from 'browser-fs-access';

import { Box, Button, ColorPaletteProp, Dropdown, IconButton, ListDivider, ListItemDecorator, Menu, MenuButton, MenuItem, Sheet } from '@mui/joy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DWorkspaceId } from '~/common/stores/workspace/workspace.types';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { WindowFocusObserver } from '~/common/util/windowUtils';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';
import { workspaceActions } from '~/common/stores/workspace/store-client-workspace';

import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { LiveFileChooseIcon, LiveFileCloseIcon, LiveFileIcon, LiveFileReloadIcon, LiveFileSaveIcon } from '~/common/livefile/liveFile.icons';
import { isLiveFileSupported, liveFileCreateOrThrow } from '~/common/livefile/store-live-file';
import { liveFileSheetSx } from '~/common/livefile/livefile.theme';
import { useLiveFileContent } from '~/common/livefile/useLiveFileContent';

import { LiveFileControlButton } from './LiveFileControlButton';


interface LinesDiffSummary {
  insertions: number;
  deletions: number;
}

function _computeLineDiffStats(fromText: string, toText: string): LinesDiffSummary {
  // compute the insertions and deletions diff - NOTE: lines are the most common
  return (diffLines(fromText, toText) || []).reduce((acc, part) => {
    if (part.added) acc.insertions += part.count ?? 1;
    if (part.removed) acc.deletions += part.count ?? 1;
    return acc;
  }, { insertions: 0, deletions: 0 });
}


interface FileOperationStatus {
  message: React.ReactNode;
  mtype: 'info' | 'changes' | 'success' | 'error';
}


export function useLiveFileSync(
  _liveFileId: LiveFileId | null,
  workspaceId: DWorkspaceId | null,
  isMobile: boolean,
  bufferText: string,
  onReplaceLiveFileId: (liveFileId: LiveFileId) => void,
  onSetBufferText: (text: string) => void,
) {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const [diffSummary, setDiffSummary] = React.useState<LinesDiffSummary | null>(null);
  const [status, setStatus] = React.useState<FileOperationStatus | null>(null);

  // external state
  const {
    fileData,
    isPairingValid,
    liveFileContentClose,
    liveFileContentReloadFromDisk,
    liveFileContentWriteAndReload,
  } = useLiveFileContent(_liveFileId);

  // derived state
  const fileContent = fileData?.content ?? undefined;
  const fileErrorText = fileData?.error ?? undefined;
  const isLoadingFile = fileData?.isLoading ?? false;
  const isSavingFile = fileData?.isSaving ?? false;

  const fileHasContent = fileContent !== undefined;
  const fileIsDifferent = !!diffSummary?.deletions || !!diffSummary?.insertions;

  const shallUpdateOnRefocus = isPairingValid && fileHasContent;


  // [effect] Auto-compute the diffs when the underlying text changes
  React.useEffect(() => {
    if (fileContent === undefined || bufferText === undefined) {
      setDiffSummary(null);
      return;
    }

    // Same content: no diff
    if (fileContent === bufferText) {
      setDiffSummary({ insertions: 0, deletions: 0 });
      setStatus({ message: isMobile ? 'Identical to File.' : 'No changes.' /* 'The File is identical to this Document.'*/, mtype: 'info' });
      return;
    }

    // Compute the diff
    const lineDiffs = _computeLineDiffStats(bufferText, fileContent);
    setDiffSummary(lineDiffs);
    if (lineDiffs.insertions && lineDiffs.deletions)
      setStatus({
        message: <>File has {lineDiffs.insertions?.toLocaleString()} <Box component='span' sx={{ color: 'success.solidBg' }}>added</Box> and {lineDiffs.deletions?.toLocaleString()} <Box component='span' sx={{ color: 'danger.softColor' }}>removed</Box> lines.</>,
        mtype: 'changes',
      });
    else if (lineDiffs.insertions)
      setStatus({ message: <>File has {lineDiffs.insertions?.toLocaleString()} <Box component='span' sx={{ color: 'success.solidBg' }}>added lines</Box>.</>, mtype: 'changes' });
    else if (lineDiffs.deletions)
      setStatus({ message: <>File has {lineDiffs.deletions?.toLocaleString()} <Box component='span' sx={{ color: 'danger.softColor' }}>removed lines</Box>.</>, mtype: 'changes' });
    else
      setStatus({ message: 'No changes.', mtype: 'info' });
  }, [bufferText, fileContent, isMobile]);

  // [effect] On error, replace the status message with the error message
  React.useEffect(() => {
    if (fileErrorText)
      setStatus({ message: fileErrorText, mtype: 'error' });
  }, [fileErrorText]);


  // callbacks

  const handleStopLiveFile = React.useCallback(async () => {
    await liveFileContentClose();
    setDiffSummary(null);
    setStatus(null);
  }, [liveFileContentClose]);

  const _handleReloadFileContent = React.useCallback(async (liveFileId?: LiveFileId) => {
    if (isLoadingFile)
      setStatus({ message: 'Already Loading file...', mtype: 'info' });
    if (!fileHasContent)
      setStatus({ message: 'Reading file...', mtype: 'info' });
    await liveFileContentReloadFromDisk(liveFileId);
    // content and errors will be reactive here (see effects)
  }, [fileHasContent, isLoadingFile, liveFileContentReloadFromDisk]);

  const handlePairNewFSFHandle = React.useCallback(async (fsfHandle: FileSystemFileHandle) => {
    // Pair the file: create a LiveFile, replace it in the Fragment, and load the preview
    try {
      const liveFileId = await liveFileCreateOrThrow(fsfHandle);
      if (!workspaceId)
        console.warn('[DEV] No workspaceId to pair the file with.');
      else
        workspaceActions().liveFileAssign(workspaceId, liveFileId);
      onReplaceLiveFileId(liveFileId);
      // Immediately load the preview on this ID
      await _handleReloadFileContent(liveFileId);
    } catch (error: any) {
      setStatus({ message: `Error pairing the file: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`, mtype: 'error' });
    }
  }, [_handleReloadFileContent, onReplaceLiveFileId, workspaceId]);

  const handlePairNewFileWithPicker = React.useCallback(async () => {
    // pick a file
    const fileWithHandle = await fileOpen({ description: 'Select a File to pair to this document' }).catch(() => null /* The User closed the files picker */);
    if (!fileWithHandle)
      return;
    if (fileWithHandle.handle)
      await handlePairNewFSFHandle(fileWithHandle.handle);
    else
      setStatus({ message: `Browser does not support LiveFile operations. ${isLiveFileSupported() ? 'No filesystem handles.' : ''}`, mtype: 'error' });
  }, [handlePairNewFSFHandle]);


  // Save and Load from Disk

  const handleLoadFromDisk = React.useCallback(() => {
    if (fileContent === undefined)
      setStatus({ message: 'No file content loaded. Please preview changes first.', mtype: 'info' });
    else
      onSetBufferText(fileContent);
  }, [fileContent, onSetBufferText]);

  const handleSaveToDisk = React.useCallback(async (event: React.MouseEvent) => {
    if (!isPairingValid) {
      setStatus({ message: 'No file paired. Please choose a file first.', mtype: 'info' });
      return;
    }

    // ask the user for confirmation before saving to file
    if (!event.shiftKey && !await showPromisedOverlay('livefile-overwrite', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        title='Overwrite File'
        positiveActionText='Overwrite'
        confirmationText='Are you sure you want to overwrite the file with the current contents?'
      />,
    )) return;

    setStatus({ message: 'Saving to file...', mtype: 'info' });
    const saved = await liveFileContentWriteAndReload(bufferText);
    if (!saved) {
      // if not saved, the error will be shown in the effect
    } else
      setStatus({ message: 'Content saved to file.', mtype: 'success' });
  }, [bufferText, isPairingValid, liveFileContentWriteAndReload, showPromisedOverlay]);


  // Memoed components code

  const liveFileControlButton = React.useMemo(() => !isLiveFileSupported() ? null : (
    <LiveFileControlButton
      disabled={isSavingFile}
      hasContent={fileHasContent}
      hideWhenHasContent
      isPaired={isPairingValid}
      onPairWithFSFHandle={handlePairNewFSFHandle}
      onPairWithPicker={handlePairNewFileWithPicker}
      onUpdateFileContent={_handleReloadFileContent}
    />
  ), [fileHasContent, handlePairNewFSFHandle, handlePairNewFileWithPicker, _handleReloadFileContent, isPairingValid, isSavingFile]);

  const liveFileActions = React.useMemo(() => {
    if (!isLiveFileSupported() || (!status && !fileHasContent))
      return null;

    const isError = status?.mtype === 'error';

    const statusColor: ColorPaletteProp =
      isError ? 'warning'
        : status?.mtype === 'success' ? 'success'
          : status?.mtype === 'changes' ? 'neutral'
            : 'neutral';

    return (
      <Sheet color={statusColor} sx={liveFileSheetSx}>

        <Box sx={{ display: 'flex', alignItems: 'center' }}>

          {/* Refresh Content Button */}
          {isPairingValid && (
            <TooltipOutlined title='Reload and compare File' placement='top-start' color='success'>
              <IconButton size='sm' variant='outlined' onClick={() => _handleReloadFileContent()} sx={{ mr: 1 }}>
                <LiveFileIcon color='success' />
              </IconButton>
            </TooltipOutlined>
          )}

          {/* Alert Decorator (startDecorator will have it messy) */}
          {status?.mtype === 'error' && <WarningRoundedIcon sx={{ mr: 1 }} />}

          {' '}<span>{status?.message}</span>

        </Box>


        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {/* Load from file */}
          {fileIsDifferent && !isError && (
            <Button
              variant='outlined'
              color='neutral'
              size='sm'
              // disabled={isLoadingFile /* commented to not make this flash */}
              onClick={handleLoadFromDisk}
              startDecorator={<LiveFileReloadIcon />}
              aria-label='Load content from disk'
            >
              {isMobile ? 'Update' : 'Replace with file'}
            </Button>
          )}

          {/* Save to File */}
          {fileIsDifferent && !isError && (
            <Button
              variant='outlined'
              color='danger'
              size='sm'
              disabled={isSavingFile}
              onClick={handleSaveToDisk}
              startDecorator={<LiveFileSaveIcon />}
              aria-label='Save content to disk'
            >
              {isMobile ? 'Save' : 'Save to file'}
            </Button>
          )}

          {/* More Controls */}
          <Dropdown>

            <MenuButton
              aria-label='LiveFile Controls'
              slots={{ root: IconButton }}
              slotProps={{ root: { size: 'sm' } }}
            >
              <MoreVertIcon />
            </MenuButton>

            <Menu size='md' sx={{ minWidth: 220 }}>

              {/* Reassign File button */}
              <MenuItem onClick={handlePairNewFileWithPicker}>
                <ListItemDecorator>
                  <LiveFileChooseIcon />
                </ListItemDecorator>
                Pair a different file
              </MenuItem>

              <ListDivider />

              {/* Close button */}
              <MenuItem onClick={handleStopLiveFile}>
                <ListItemDecorator>
                  <LiveFileCloseIcon />
                </ListItemDecorator>
                Stop sync
              </MenuItem>

            </Menu>
          </Dropdown>

        </Box>
      </Sheet>
    );
  }, [fileHasContent, fileIsDifferent, handleStopLiveFile, handleLoadFromDisk, handlePairNewFileWithPicker, handleSaveToDisk, _handleReloadFileContent, isMobile, isPairingValid, isSavingFile, status]);


  // Auto-click on 'refresh' on window focus

  React.useEffect(() => {
    return WindowFocusObserver.getInstance().subscribe(async (focused) => {
      if (focused && shallUpdateOnRefocus)
        await _handleReloadFileContent();
    });
  }, [_handleReloadFileContent, shallUpdateOnRefocus]);


  return {
    liveFileActions,
    liveFileControlButton,
  };
}
