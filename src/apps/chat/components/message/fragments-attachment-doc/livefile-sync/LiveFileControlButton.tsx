import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp, SvgIcon } from '@mui/joy';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { getFirstFileSystemFileHandle } from '~/common/util/fileSystemUtils';
import { useDragDropDataTransfer } from '~/common/components/useDragDropDataTransfer';

import { LiveFileChooseIcon, LiveFileIcon } from '~/common/livefile/liveFile.icons';


// configuration
const BUTTON_COLOR: ColorPaletteProp = 'neutral';


// const controlButtonSx: SxProps = {
//   minHeight: 36,
// };

const refreshButtonSx: SxProps = {
  // border: '1px solid',
  // borderColor: `${BUTTON_COLOR}.outlinedBorder`,
  boxShadow: `inset 0 4px 6px -6px rgb(var(--joy-palette-${BUTTON_COLOR}-darkChannel) / 40%)`,
};


export function LiveFileControlButton(props: {
  disabled: boolean;
  hasContent: boolean;
  hideWhenHasContent: boolean;
  isPaired: boolean;
  onPairWithFSFHandle: (fsHandle: FileSystemFileHandle) => Promise<any>;
  onPairWithPicker: () => Promise<any>;
  onUpdateFileContent: () => Promise<any>;
}) {

  const { onPairWithFSFHandle, onPairWithPicker, onUpdateFileContent } = props;

  // state

  const handleDataTransfer = React.useCallback(async (dataTransfer: DataTransfer) => {
    const fsfHandle = await getFirstFileSystemFileHandle(dataTransfer);
    if (fsfHandle)
      await onPairWithFSFHandle(fsfHandle);
  }, [onPairWithFSFHandle]);

  const { dragContainerSx, dropComponent, handleContainerDragEnter, handleContainerDragStart } =
    useDragDropDataTransfer(true, 'Pair', UploadFileRoundedIcon as typeof SvgIcon, 'startDecorator', true, handleDataTransfer);

  // hooks

  const handleOnClick = React.useCallback(async () => {
    if (props.isPaired)
      await onUpdateFileContent();
    else
      await onPairWithPicker();
  }, [onPairWithPicker, onUpdateFileContent, props.isPaired]);

  if (props.hideWhenHasContent && props.hasContent)
    return null;

  return (
    <Box
      onDragEnter={handleContainerDragEnter}
      onDragStart={handleContainerDragStart}
      sx={dragContainerSx}
    >
      <TooltipOutlined
        title={
          props.hasContent ? 'Reload and compare file contents'
            : props.isPaired ? 'Sync and monitor file changes'
              : 'Set up live file pairing'
        }
        color='success'
        placement='top-end'
      >
        <Button
          variant={props.hasContent ? 'outlined' : 'plain'}
          color={BUTTON_COLOR}
          size='sm'
          disabled={props.disabled}
          onClick={handleOnClick}
          endDecorator={
            props.hasContent ? <LiveFileIcon color='success' />
              : props.isPaired ? <LiveFileIcon color='success' />
                : <LiveFileChooseIcon color='success' />
          }
          sx={props.hasContent ? refreshButtonSx : undefined /*controlButtonSx*/}
        >
          {props.hasContent ? 'Refresh'
            : props.isPaired ? 'Enable Sync'
              : 'Pair File'}
        </Button>
      </TooltipOutlined>

      {dropComponent}
    </Box>
  );
}