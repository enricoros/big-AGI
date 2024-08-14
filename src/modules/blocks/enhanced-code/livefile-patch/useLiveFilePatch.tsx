import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';

import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { isLiveFileSupported, liveFileCreateOrThrow } from '~/common/livefile/store-live-file';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { WorkspaceLiveFilePicker } from '~/common/stores/workspace/WorkspaceLiveFilePicker';


export function useLiveFilePatch(title: string, code: string, isPartial: boolean, isMobile: boolean) {

  /**
   * state - Warning: very local.
   * This will get wiped just on a component remount - so it's just a temporary solution.
   */
  const [liveFileId, setLiveFileId] = React.useState<LiveFileId | null>(null);

  // external state
  const isEnabled = useUXLabsStore((state) => state.labsEnhanceCodeLiveFile && isLiveFileSupported());


  // handlers
  const handleLiveFileSelected = React.useCallback((id: LiveFileId | null) => {
    setLiveFileId(id);
  }, []);

  const handleSelectNewFile = React.useCallback(async () => {
    try {
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: title,
        // types: [{ description: 'Text Files', accept: { 'text/plain': ['.txt'] } }],
      });
      const newLiveFileId = await liveFileCreateOrThrow(fileHandle);
      setLiveFileId(newLiveFileId);
    } catch (error) {
      console.error('Error creating new file:', error);
    }
  }, [title]);


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
        buttonLabel='Insert...'
        liveFileId={liveFileId}
        onSelectLiveFile={handleLiveFileSelected}
        onSelectNewFile={handleSelectNewFile}
      />

    </Box>
  ), [handleLiveFileSelected, isEnabled, liveFileId, title]);


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