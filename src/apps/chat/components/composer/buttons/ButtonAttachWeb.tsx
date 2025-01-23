import * as React from 'react';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';

import { buttonAttachSx } from '~/common/components/ButtonAttachFiles';


export const ButtonAttachWebMemo = React.memo(ButtonAttachWeb);

function ButtonAttachWeb(props: {
  isMobile?: boolean,
  disabled?: boolean,
  fullWidth?: boolean,
  noToolTip?: boolean,
  onOpenWebInput: () => void,
}) {

  const button = props.isMobile ? (
    <IconButton disabled={props.disabled} onClick={props.onOpenWebInput}>
      <LanguageRoundedIcon />
    </IconButton>
  ) : (
    <Button
      variant='plain'
      color='neutral'
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
    <Tooltip arrow disableInteractive placement='top-start' title={(
      <Box sx={buttonAttachSx.tooltip}>
        <b>Add Web Content 🌐</b><br />
        Import from websites and YouTube
      </Box>
    )}>
      {button}
    </Tooltip>
  );
}
