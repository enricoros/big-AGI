import * as React from 'react';

import { Box, Button } from '@mui/joy';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { useDragDropDataTransfer } from '~/common/components/useDragDropDataTransfer';

import { LiveFileChooseIcon, LiveFileIcon } from './liveFile.icons';


export function LiveFileSyncButton(props: {
  fileHasContent: boolean;
  isPairingValid: boolean;
  isSavingFile: boolean;
  handleSyncButtonClicked: () => void;
}) {

  const handleDataTransfer = React.useCallback(async (dataTransfer: DataTransfer) => {
    console.log('LiveFileSyncButton: handleDataTransfer', dataTransfer);
  }, []);

  const {
    dragContainerSx,
    dropComponent,
    handleContainerDragEnter,
    handleContainerDragStart,
  } = useDragDropDataTransfer(true, 'Pair', null, 'startDecorator', handleDataTransfer);

  return (
    <Box
      onDragEnter={handleContainerDragEnter}
      onDragStart={handleContainerDragStart}
      sx={dragContainerSx}
    >

      <TooltipOutlined
        title={
          props.fileHasContent ? 'Click to reload the File and compare.'
            : props.isPairingValid ? 'Click to compare with the File contents.'
              : 'Setup LiveFile pairing.'
        }
        color={props.fileHasContent ? 'primary' : 'success'}
        variant={props.fileHasContent ? undefined : 'solid'}
      >
        <Button
          variant='soft'
          color={props.fileHasContent ? 'primary' : 'success'}
          size='sm'
          disabled={props.isSavingFile}
          onClick={props.handleSyncButtonClicked}
          startDecorator={
            props.fileHasContent ? <LiveFileIcon />
              : (props.isPairingValid ? <LiveFileIcon />
                : <LiveFileChooseIcon />)
          }
          aria-label={props.isPairingValid ? 'Sync File' : 'Choose File'}
        >
          {props.fileHasContent ? 'Refresh'
            : props.isPairingValid ? 'Sync File'
              : 'Pair File'}
        </Button>
      </TooltipOutlined>

      {dropComponent}
    </Box>
  );
}