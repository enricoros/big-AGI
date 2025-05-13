import * as React from 'react';

import { Box, Button, ColorPaletteProp, IconButton, Tooltip } from '@mui/joy';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';

import { buttonAttachSx } from '~/common/components/ButtonAttachFiles';
import { KeyStroke } from '~/common/components/KeyStroke';


export const ButtonAttachWebMemo = React.memo(ButtonAttachWeb);

function ButtonAttachWeb(props: {
  color?: ColorPaletteProp,
  isMobile?: boolean,
  disabled?: boolean,
  fullWidth?: boolean,
  noToolTip?: boolean,
  onOpenWebInput: () => void,
}) {

  const button = props.isMobile ? (
    <IconButton color={props.color} disabled={props.disabled} onClick={props.onOpenWebInput}>
      <LanguageRoundedIcon />
    </IconButton>
  ) : (
    <Button
      variant={props.color ? 'soft' : 'plain'}
      color={props.color || 'neutral'}
      disabled={props.disabled}
      fullWidth={props.fullWidth}
      startDecorator={<LanguageRoundedIcon />}
      onClick={props.onOpenWebInput}
      sx={buttonAttachSx.desktop}
    >
      Web
    </Button>
  );

  return (props.noToolTip || props.isMobile) ? button : (
    <Tooltip arrow disableInteractive placement='top-start' title={
      <Box sx={buttonAttachSx.tooltip}>
        <b>Add Web Content 🌐</b><br />
        Import from websites and YouTube
        <KeyStroke combo='Ctrl + Shift + L' sx={{ mt: 1, mb: 0.5 }} />
      </Box>
    }>
      {button}
    </Tooltip>
  );
}
