import * as React from 'react';

import { Box, Button, SvgIcon } from '@mui/joy';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { getDataTransferFilesOrPromises } from '~/common/util/fileSystemUtils';
import { useDragDropDataTransfer } from '~/common/components/useDragDropDataTransfer';

import { LiveFileChooseIcon, LiveFileIcon } from './liveFile.icons';


export function LiveFileSyncButton(props: {
  disabled: boolean;
  hasContent: boolean;
  isPaired: boolean;
  onPairWithFSFHandle: (fsHandle: FileSystemFileHandle) => Promise<any>;
  onPairWithPicker: () => Promise<void>;
  upUpdateFileContent: () => void;
}) {

  const { onPairWithFSFHandle } = props;

  const handleDataTransfer = React.useCallback(async (dataTransfer: DataTransfer) => {
    // get FileSystemFileHandle objects from the DataTransfer
    const fileOrFSHandlePromises = getDataTransferFilesOrPromises(dataTransfer.items, false);
    if (!fileOrFSHandlePromises.length)
      return;

    // resolve the promises to get the actual files/handles
    const filesOrHandles = await Promise.all(fileOrFSHandlePromises);
    for (let filesOrHandle of filesOrHandles) {
      if (!(filesOrHandle instanceof File) && filesOrHandle?.kind === 'file' && filesOrHandle) {
        await onPairWithFSFHandle(filesOrHandle);
        break;
      }
    }
  }, [onPairWithFSFHandle]);

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
          props.hasContent ? 'Click to reload the File and compare.'
            : props.isPaired ? 'Click to compare with the File contents.'
              : 'Setup LiveFile pairing.'
        }
        color={props.hasContent ? 'primary' : 'success'}
        variant={props.hasContent ? undefined : 'solid'}
      >
        <Button
          variant='soft'
          color={props.hasContent ? 'primary' : 'success'}
          size='sm'
          disabled={props.disabled}
          onClick={props.isPaired ? props.upUpdateFileContent : props.onPairWithPicker}
          startDecorator={
            props.hasContent ? <LiveFileIcon />
              : (props.isPaired ? <LiveFileIcon />
                : <LiveFileChooseIcon />)
          }
          aria-label={props.isPaired ? 'Sync File' : 'Choose File'}
        >
          {props.hasContent ? 'Refresh'
            : props.isPaired ? 'Sync File'
              : 'Pair File'}
        </Button>
      </TooltipOutlined>

      {dropComponent}
    </Box>
  );
}