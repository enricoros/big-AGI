import * as React from 'react';
import { fileOpen } from 'browser-fs-access';
import { cleanupEfficiency, makeDiff } from '@sanity/diff-match-patch';

import { Alert, Box, Button, CircularProgress, ColorPaletteProp, IconButton } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import type { DMessageAttachmentFragment } from '~/common/stores/chat/chat.fragments';
import { LiveFileChooseIcon, LiveFileIcon, LiveFileReloadIcon, LiveFileSaveIcon } from '~/common/livefile/LiveFileIcons';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { liveFileCreate } from '~/common/livefile/liveFile';


interface DiffSummary {
  insertions: number;
  deletions: number;
}

function calculateDiffStats(oldText: string, newText: string): DiffSummary {
  // compute the insertions and deletions diff - NOTE: character-based, not lines
  const diffs = cleanupEfficiency(makeDiff(oldText, newText, {
    timeout: 1,
    checkLines: true,
  }), 4);

  return diffs.reduce((acc, [operation, text]) => {
    if (operation === 1) acc.insertions += text.length;
    else if (operation === -1) acc.deletions += text.length;
    return acc;
  }, { insertions: 0, deletions: 0 });
}


interface FileOperationStatus {
  message: string;
  mtype: 'info' | 'changes' | 'success' | 'error';
}


export function useLiveFile(
  isMobile: boolean | undefined,
  memoryText: string,
  attachmentLiveFile: DMessageAttachmentFragment['_liveFile'] | undefined,
  setAttachmentLiveFile: (liveFile: DMessageAttachmentFragment['_liveFile']) => void,
  setDocAttachmentText: (text: string) => void,
) {

  // state
  const [isWorking, setIsWorking] = React.useState(false);
  const [diskText, setDiskText] = React.useState<string | null>(null);
  const [diffSummary, setDiffSummary] = React.useState<DiffSummary | null>(null);
  const [status, setStatus] = React.useState<FileOperationStatus | null>(null);
  const [isPreviewMode, setIsPreviewMode] = React.useState(false);

  // derived state
  const fileSystemFileHandle = attachmentLiveFile?._fsFileHandle as FileSystemFileHandle | undefined;

  // callbacks

  const resetState = React.useCallback(() => {
    setIsWorking(false);
    setDiskText(null);
    setDiffSummary(null);
    setStatus(null);
    setIsPreviewMode(false);
  }, []);

  const loadFilePreview = React.useCallback(async (fileHandle?: FileSystemFileHandle) => {
    // can manually pass a file handle to preview changes
    const handleToUse = fileHandle || fileSystemFileHandle;
    if (!handleToUse) {
      setStatus({ message: 'No file associated. Please choose a file first.', mtype: 'info' });
      return;
    }
    // avoid concurrent calls
    if (isWorking)
      return;

    setIsWorking(true);
    if (!isPreviewMode)
      setStatus({ message: 'Reading file...', mtype: 'info' });
    try {
      const file = await handleToUse.getFile();
      const newDiskText = await file.text();
      const summary = calculateDiffStats(memoryText, newDiskText);
      setDiskText(newDiskText);
      setDiffSummary(summary);
      setStatus({
        message: (summary.insertions === 0 && summary.deletions === 0)
          ? 'File has no changes.'
          : `File has: ${summary.insertions ? summary.insertions : 'no'} insertions, ${summary.deletions ? summary.deletions : 'no'} deletions.`,
        mtype: (summary.insertions === 0 && summary.deletions === 0) ? 'info' : 'changes',
      });
      setIsPreviewMode(true);
    } catch (error) {
      setStatus({ message: `Error loading file: ${error instanceof Error ? error.message : 'Unknown error'}`, mtype: 'error' });
    }
    setIsWorking(false);
  }, [fileSystemFileHandle, isPreviewMode, isWorking, memoryText]);

  const associateAndPreviewFile = React.useCallback(async () => {
    try {
      const fileWithHandle = await fileOpen({ description: 'Select a File to pair to this document' });
      if (!fileWithHandle) {
        setStatus({ message: 'No file chosen.', mtype: 'info' });
      } else {
        setAttachmentLiveFile(liveFileCreate(fileWithHandle));
        // Immediately load preview after associating the file
        await loadFilePreview(fileWithHandle.handle as FileSystemFileHandle);
      }
    } catch (error) {
      resetState();
      // Note: we don't show this warning, as the user just cancelled the file picker
      // setStatus({ message: `Error associating file: ${error instanceof Error ? error.message : 'Unknown error'}`, type: 'error' });
    }
  }, [loadFilePreview, resetState, setAttachmentLiveFile]);

  const handleSyncButtonClick = React.useCallback(async () => {
    if (fileSystemFileHandle) {
      // Always load preview when we have a file handle, regardless of current state
      await loadFilePreview();
    } else {
      await associateAndPreviewFile();
    }
  }, [associateAndPreviewFile, fileSystemFileHandle, loadFilePreview]);

  const handleLoadFromDisk = React.useCallback(() => {
    if (diskText === null) {
      setStatus({ message: 'No file content loaded. Please preview changes first.', mtype: 'info' });
      return;
    }
    setDocAttachmentText(diskText);
    setDiffSummary(null);
    setStatus({ message: 'Content loaded from file.', mtype: 'success' });
  }, [diskText, setDocAttachmentText]);

  const handleSaveToDisk = React.useCallback(async () => {
    if (!fileSystemFileHandle) {
      setStatus({ message: 'No file associated. Please choose a file first.', mtype: 'info' });
      return;
    }
    setIsWorking(true);
    setStatus({ message: 'Saving to file...', mtype: 'info' });
    try {
      const writable = await fileSystemFileHandle.createWritable();
      await writable.write(memoryText);
      await writable.close();
      resetState();
      setStatus({ message: 'Content saved to file.', mtype: 'success' });
    } catch (error) {
      setStatus({ message: `Error saving to file: ${error instanceof Error ? error.message : 'Unknown error'}`, mtype: 'error' });
    }
    setIsWorking(false);
  }, [fileSystemFileHandle, memoryText, resetState]);


  const liveFileSyncButton = React.useMemo(() => (
    <TooltipOutlined
      title={
        isPreviewMode ? 'Click to update the comparison.'
          : fileSystemFileHandle ? 'Click compare with the File contents.'
            : 'Setup LiveFile association.'
      }
      color={isPreviewMode ? 'primary' : 'success'}
      variant={isPreviewMode ? undefined : 'solid'}
      placement='top-end'
    >
      <Button
        variant='soft'
        color={isPreviewMode ? 'primary' : 'success'}
        size='sm'
        disabled={isWorking}
        onClick={handleSyncButtonClick}
        startDecorator={
          isPreviewMode ? <LiveFileIcon />
            : (isWorking ? <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />
              : fileSystemFileHandle ? <LiveFileIcon />
                : <LiveFileChooseIcon />)
        }
        aria-label={fileSystemFileHandle ? 'Sync File' : 'Choose File'}
      >
        {
          isPreviewMode ? 'Refresh'
            : fileSystemFileHandle ? 'Sync File'
              : 'Pair File'
        }
      </Button>
    </TooltipOutlined>
  ), [fileSystemFileHandle, handleSyncButtonClick, isPreviewMode, isWorking]);


  const liveFileActionBox = React.useMemo(() => {
    if (!status && !isPreviewMode) return null;

    const statusColor: ColorPaletteProp = status?.mtype === 'error' ? 'danger'
      : status?.mtype === 'success' ? 'success'
        : status?.mtype === 'changes' ? 'primary'
          : 'neutral';

    return (
      <Alert
        variant='plain'
        color={statusColor}
        startDecorator={status?.mtype === 'error' ? <WarningRoundedIcon /> : undefined}
        sx={{
          display: 'flex',
          flexFlow: 'row wrap',
          alignItems: 'center',
          gap: 1,
          p: 1,
          boxShadow: 'xs',
        }}
      >
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {isPreviewMode && !!fileSystemFileHandle && (
            <IconButton size='sm' onClick={handleSyncButtonClick}>
              <LiveFileIcon />
            </IconButton>
          )}
          {' '}<span>{status?.message}</span>
        </Box>


        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {/* Load from File */}
          {(diffSummary && (diffSummary.insertions > 0 || diffSummary.deletions > 0)) && (
            <Button
              variant={isMobile ? 'outlined' : 'plain'}
              color='primary'
              size='sm'
              disabled={isWorking}
              onClick={handleLoadFromDisk}
              startDecorator={<LiveFileReloadIcon />}
              aria-label='Load content from disk'
            >
              {isMobile ? 'Update' : 'Load from File'}
            </Button>
          )}

          {/* Save to File */}
          {(diffSummary && (diffSummary.insertions > 0 || diffSummary.deletions > 0)) && (
            <Button
              variant={isMobile ? 'outlined' : 'plain'}
              color='danger'
              size='sm'
              disabled={isWorking}
              onClick={handleSaveToDisk}
              startDecorator={<LiveFileSaveIcon />}
              aria-label='Save content to disk'
            >
              {isMobile ? 'Save' : 'Save to File'}
            </Button>
          )}

          {/* Reassign File button */}
          <TooltipOutlined title='Pair a different File.' placement='top-end'>
            <IconButton size='sm' onClick={associateAndPreviewFile}>
              <LiveFileChooseIcon />
            </IconButton>
          </TooltipOutlined>

          {/* Close button */}
          <TooltipOutlined title='Close LiveFile.' placement='top-end'>
            <IconButton size='sm' onClick={resetState}>
              <CloseRoundedIcon />
            </IconButton>
          </TooltipOutlined>
        </Box>
      </Alert>
    );
  }, [diffSummary, fileSystemFileHandle, handleLoadFromDisk, handleSaveToDisk, handleSyncButtonClick, isMobile, isPreviewMode, isWorking, resetState, status]);


  return {
    liveFileSyncButton,
    liveFileActionBox,
    liveFileLoadPreview: (isPreviewMode && diskText !== null) ? loadFilePreview : undefined,
  };
}
