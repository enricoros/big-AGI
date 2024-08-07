import * as React from 'react';

import { Box, Button, SvgIcon } from '@mui/joy';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { useDragDropDataTransfer } from '~/common/components/useDragDropDataTransfer';

import { LiveFileChooseIcon, LiveFileIcon } from './liveFile.icons';


export function LiveFileSyncButton(props: {
  disabled: boolean;
  isPaired: boolean;
  isRead: boolean;
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
  } = useDragDropDataTransfer(true, 'Pair', UploadFileRoundedIcon as typeof SvgIcon, 'startDecorator', true, handleDataTransfer);

  return (
    <Box
      onDragEnter={handleContainerDragEnter}
      onDragStart={handleContainerDragStart}
      sx={dragContainerSx}
    >

      <TooltipOutlined
        title={
          props.isRead ? 'Click to reload the File and compare.'
            : props.isPaired ? 'Click to compare with the File contents.'
              : 'Setup LiveFile pairing.'
        }
        color={props.isRead ? 'primary' : 'success'}
        variant={props.isRead ? undefined : 'solid'}
      >
        <Button
          variant='soft'
          color={props.isRead ? 'primary' : 'success'}
          size='sm'
          disabled={props.disabled}
          onClick={props.handleSyncButtonClicked}
          startDecorator={
            props.isRead ? <LiveFileIcon />
              : (props.isPaired ? <LiveFileIcon />
                : <LiveFileChooseIcon />)
          }
          aria-label={props.isPaired ? 'Sync File' : 'Choose File'}
        >
          {props.isRead ? 'Refresh'
            : props.isPaired ? 'Sync File'
              : 'Pair File'}
        </Button>
      </TooltipOutlined>

      {dropComponent}
    </Box>
  );
}