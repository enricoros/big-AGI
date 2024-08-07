import * as React from 'react';
import { fileOpen } from 'browser-fs-access';
import { cleanupEfficiency, makeDiff } from '@sanity/diff-match-patch';

import { Alert, Box, Button, ColorPaletteProp, IconButton } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { WindowFocusObserver } from '~/common/util/windowUtils';

import type { LiveFileId } from './liveFile.types';
import { LiveFileChooseIcon, LiveFileIcon, LiveFileReloadIcon, LiveFileSaveIcon } from './liveFile.icons';
import { liveFileCreateOrThrow } from './store-live-file';
import { useLiveFile } from './liveFile.hooks';
import { LiveFileSyncButton } from '~/common/livefile/LiveFileSyncButton';



interface DiffSummary {
  insertions: number;
  deletions: number;
}

function calculateDiffStats(fromText: string, toText: string): DiffSummary {
  // compute the insertions and deletions diff - NOTE: character-based, not lines
  const diffs = cleanupEfficiency(makeDiff(fromText, toText, {
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


export function useLiveFileComparison(
  _liveFileId: LiveFileId | null,
  isMobile: boolean,
  bufferText: string,
  setBufferText: (text: string) => void,
  replaceLiveFileId: (liveFileId: LiveFileId) => void,
) {

  // state
  const [diffSummary, setDiffSummary] = React.useState<DiffSummary | null>(null);
  const [status, setStatus] = React.useState<FileOperationStatus | null>(null);

  // external state
  const {
    fileData,
    isPairingValid,
    closeFileContent,
    reloadFileContent,
    saveFileContent,
  } = useLiveFile(_liveFileId);

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
      setStatus({ message: isMobile ? 'Identical to File.' : 'The File is identical to this Document.', mtype: 'info' });
      return;
    }

    // Compute the diff
    const summary = calculateDiffStats(fileContent, bufferText);
    setDiffSummary(summary);
    if (summary.insertions && summary.deletions)
      setStatus({
        message: `Document has ${summary.insertions} insertions and ${summary.deletions} deletions.`,
        mtype: 'changes',
      });
    else if (summary.insertions)
      setStatus({ message: `Document has ${summary.insertions} insertions.`, mtype: 'changes' });
    else if (summary.deletions)
      setStatus({ message: `Document has ${summary.deletions} deletions.`, mtype: 'changes' });
    else
      setStatus({ message: 'No changes.', mtype: 'info' });
  }, [bufferText, fileContent, isMobile]);

  // [effect] On error, replace the status message with the error message
  React.useEffect(() => {
    if (fileErrorText)
      setStatus({ message: fileErrorText, mtype: 'error' });
  }, [fileErrorText]);


  // callbacks

  const handleCloseFile = React.useCallback(async () => {
    await closeFileContent();
    setDiffSummary(null);
    setStatus(null);
  }, [closeFileContent]);

  const handleUpdateFileContent = React.useCallback(async (liveFileId?: LiveFileId) => {
    if (!isLoadingFile) {
      if (!fileHasContent)
        setStatus({ message: 'Reading file...', mtype: 'info' });
      await reloadFileContent(liveFileId);
      // content and errors will be reactive here (see effects)
    }
  }, [fileHasContent, isLoadingFile, reloadFileContent]);

  const handlePairNewFileWithPicker = React.useCallback(async () => {
    // Open the file picker
    const fileWithHandle = await fileOpen({ description: 'Select a File to pair to this document' }).catch(() => null /* The User closed the files picker */);
    if (!fileWithHandle)
      return;
    if (!fileWithHandle.handle) {
      setStatus({ message: 'Browser does not support LiveFile operations.', mtype: 'error' });
      return;
    }

    // Pair the file: create a LiveFile, replace it in the Fragment, and load the preview
    try {
      const liveFileId = await liveFileCreateOrThrow(fileWithHandle.handle);
      replaceLiveFileId(liveFileId);
      // Immediately load the preview on this ID
      await handleUpdateFileContent(liveFileId);
    } catch (error: any) {
      setStatus({ message: `Error pairing the file: ${error?.message || typeof error === 'string' ? error : 'Unknown error'}`, mtype: 'error' });
    }
  }, [replaceLiveFileId, handleUpdateFileContent]);

  const handleSyncButtonClicked = React.useCallback(async () => {
    if (isPairingValid)
      await handleUpdateFileContent();
    else
      await handlePairNewFileWithPicker();
  }, [handlePairNewFileWithPicker, handleUpdateFileContent, isPairingValid]);


  // Save and Load from Disk

  const handleLoadFromDisk = React.useCallback(() => {
    if (fileContent === undefined)
      setStatus({ message: 'No file content loaded. Please preview changes first.', mtype: 'info' });
    else
      setBufferText(fileContent);
  }, [fileContent, setBufferText]);

  const handleSaveToDisk = React.useCallback(async () => {
    if (!isPairingValid) {
      setStatus({ message: 'No file paired. Please choose a file first.', mtype: 'info' });
      return;
    }
    setStatus({ message: 'Saving to file...', mtype: 'info' });
    const saved = await saveFileContent(bufferText);
    if (!saved) {
      // if not saved, the error will be shown in the effect
    } else
      setStatus({ message: 'Content saved to file.', mtype: 'success' });
  }, [bufferText, isPairingValid, saveFileContent]);


  // Memoed components code

  const liveFileSyncButton = React.useMemo(() => (
    <LiveFileSyncButton
      disabled={isSavingFile}
      isPaired={isPairingValid}
      isRead={fileHasContent}
      handleSyncButtonClicked={handleSyncButtonClicked}
    />
  ), [fileHasContent, handleSyncButtonClicked, isPairingValid, isSavingFile]);

  const liveFileActionBox = React.useMemo(() => {
    if (!status && !fileHasContent) return null;

    const statusColor: ColorPaletteProp =
      status?.mtype === 'error' ? 'warning'
        : status?.mtype === 'success' ? 'success'
          : status?.mtype === 'changes' ? 'neutral'
            : 'neutral';

    return (
      <Alert
        variant='plain'
        color={statusColor}
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

          {/* Pair Button */}
          {isPairingValid && (
            <IconButton size='sm' onClick={() => handleUpdateFileContent()}>
              <LiveFileIcon />
            </IconButton>
          )}

          {/* Alert Decorator (startDecorator will have it messy) */}
          {status?.mtype === 'error' && <WarningRoundedIcon sx={{ mr: 1 }} />}

          {' '}<span>{status?.message}</span>
        </Box>


        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {/* Load from File */}
          {fileIsDifferent && (
            <Button
              variant={isMobile ? 'outlined' : 'plain'}
              color='primary'
              size='sm'
              // disabled={isLoadingFile /* commented to not make this flash */}
              onClick={handleLoadFromDisk}
              startDecorator={<LiveFileReloadIcon />}
              aria-label='Load content from disk'
            >
              {isMobile ? 'Update' : 'Read File into Document'}
            </Button>
          )}

          {/* Save to File */}
          {fileIsDifferent && (
            <Button
              variant={isMobile ? 'outlined' : 'plain'}
              color='danger'
              size='sm'
              disabled={isSavingFile}
              onClick={handleSaveToDisk}
              startDecorator={<LiveFileSaveIcon />}
              aria-label='Save content to disk'
            >
              {isMobile ? 'Save' : 'Save to File'}
            </Button>
          )}

          {/* Reassign File button */}
          <TooltipOutlined title='Pair a different File.' placement='top-end'>
            <IconButton size='sm' onClick={handlePairNewFileWithPicker}>
              <LiveFileChooseIcon />
            </IconButton>
          </TooltipOutlined>

          {/* Close button */}
          <TooltipOutlined title='Close LiveFile.' placement='top-end'>
            <IconButton size='sm' onClick={handleCloseFile}>
              <CloseRoundedIcon />
            </IconButton>
          </TooltipOutlined>
        </Box>
      </Alert>
    );
  }, [fileHasContent, fileIsDifferent, handleCloseFile, handleLoadFromDisk, handlePairNewFileWithPicker, handleSaveToDisk, handleUpdateFileContent, isMobile, isPairingValid, isSavingFile, status]);


  // Auto-click on 'refresh' on window focus

  React.useEffect(() => {
    return WindowFocusObserver.getInstance().subscribe(async (focused) => {
      if (focused && shallUpdateOnRefocus)
        await handleUpdateFileContent();
    });
  }, [handleUpdateFileContent, shallUpdateOnRefocus]);


  return {
    liveFileSyncButton,
    liveFileActionBox,
  };
}
