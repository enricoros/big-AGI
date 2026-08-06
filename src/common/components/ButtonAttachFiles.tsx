import * as React from 'react';
import { fileOpen, FileWithHandle } from 'browser-fs-access';

import { Box, Button, ColorPaletteProp, IconButton, Tooltip } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';

import { KeyStroke } from '~/common/components/KeyStroke';


export const buttonAttachSx = {
  tooltip: { px: 1, py: 0.75, lineHeight: '1.5rem' } as const,
  desktop: { justifyContent: 'flex-start' } as const,
} as const;


export async function openFileForAttaching(
  multiple: boolean,
  onAttachFiles: (files: FileWithHandle[], errorMessage: string | null) => void | Promise<void>,
): Promise<void> {
  try {
    const selectedFiles = await fileOpen({ multiple });
    if (selectedFiles) {
      if (Array.isArray(selectedFiles)) {
        if (selectedFiles.length)
          await onAttachFiles(selectedFiles, null);
      } else {
        await onAttachFiles([selectedFiles], null);
      }
    }
  } catch (error: any) {
    // ignore user abort errors, but show others
    if (error?.name !== 'AbortError') {
      console.warn('[DEV] openFileForAttaching error:', { error });
      await onAttachFiles([], error?.message || error?.toString() || 'unknown file open error');
    }
  }
}


export const ButtonAttachFilesMemo = React.memo(ButtonAttachFiles);

function ButtonAttachFiles(props: {
  color?: ColorPaletteProp,
  multiple?: boolean,
  isMobile?: boolean,
  disabled?: boolean,
  fullWidth?: boolean,
  noToolTip?: boolean,
  onAttachFiles: (files: FileWithHandle[], errorMessage: string | null) => void,
}) {

  const { onAttachFiles } = props;

  const handleAttachFilePicker = React.useCallback(() => {
    return openFileForAttaching(props.multiple || false, onAttachFiles);
  }, [onAttachFiles, props.multiple]);

  return props.isMobile ? (
    <IconButton color={props.color} disabled={props.disabled} onClick={handleAttachFilePicker}>
      <AttachFileRoundedIcon />
    </IconButton>
  ) : (
    <Tooltip arrow disableInteractive placement='top-start' title={props.noToolTip ? null : (
      <Box sx={buttonAttachSx.tooltip}>
        <b>Attach files</b><br />
        Drag & drop in chat for faster loads ⚡
        <KeyStroke combo='Ctrl + Shift + F' sx={{ mt: 1, mb: 0.5 }} />
      </Box>
    )}>
      <Button
        variant={props.color ? 'soft' : 'plain'}
        color={props.color || 'neutral'}
        disabled={props.disabled}
        fullWidth={props.fullWidth}
        onClick={handleAttachFilePicker}
        startDecorator={<AttachFileRoundedIcon />}
        sx={buttonAttachSx.desktop}
      >
        File
      </Button>
    </Tooltip>
  );
}
