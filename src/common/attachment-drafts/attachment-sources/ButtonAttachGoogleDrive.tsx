import * as React from 'react';

import { Box, Button, ColorPaletteProp, IconButton, Tooltip } from '@mui/joy';
import AddToDriveRoundedIcon from '@mui/icons-material/AddToDriveRounded';

import { buttonAttachSx } from '~/common/components/ButtonAttachFiles';
import { KeyStroke } from '~/common/components/KeyStroke';


export const ButtonAttachGoogleDriveMemo = React.memo(ButtonAttachGoogleDrive);

function ButtonAttachGoogleDrive(props: {
  color?: ColorPaletteProp,
  isMobile?: boolean,
  disabled?: boolean,
  fullWidth?: boolean,
  noToolTip?: boolean,
  onOpenGoogleDrivePicker: () => void,
}) {

  const button = props.isMobile ? (
    <IconButton color={props.color} disabled={props.disabled} onClick={props.onOpenGoogleDrivePicker}>
      <AddToDriveRoundedIcon />
    </IconButton>
  ) : (
    <Button
      variant={props.color ? 'soft' : 'plain'}
      color={props.color || 'neutral'}
      disabled={props.disabled}
      fullWidth={props.fullWidth}
      startDecorator={<AddToDriveRoundedIcon />}
      onClick={props.onOpenGoogleDrivePicker}
      sx={buttonAttachSx.desktop}
    >
      Drive
    </Button>
  );

  return (props.noToolTip || props.isMobile) ? button : (
    <Tooltip arrow disableInteractive placement='top-start' title={
      <Box sx={buttonAttachSx.tooltip}>
        <b>Add from Google Drive</b><br />
        Attach files from your Drive
      </Box>
    }>
      {button}
    </Tooltip>
  );
}
