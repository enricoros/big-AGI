import * as React from 'react';

import { Box, Button, ColorPaletteProp, IconButton, Tooltip } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';

import { buttonAttachSx } from '~/common/components/ButtonAttachFiles';


export const ButtonAttachNewMemo = React.memo(ButtonAttachNew);

function ButtonAttachNew(props: {
  color?: ColorPaletteProp,
  isMobile?: boolean,
  disabled?: boolean,
  fullWidth?: boolean,
  noToolTip?: boolean,
  onAttachNew: () => void,
}) {
  return props.isMobile ? (
    <IconButton color={props.color} disabled={props.disabled} onClick={props.onAttachNew}>
      <AddRoundedIcon />
    </IconButton>
  ) : (
    <Tooltip arrow disableInteractive placement='top-start' title={props.noToolTip ? null : (
      <Box sx={buttonAttachSx.tooltip}>
        <b>Create new document</b><br />
        Edit your own empty document
        {/*<br />*/}
        {/*<KeyStroke combo='Ctrl + Alt + N' sx={{ mt: 1, mb: 0.5 }} />*/}
      </Box>
    )}>
      <Button
        variant={props.color ? 'soft' : 'plain'}
        color={props.color || 'neutral'}
        disabled={props.disabled}
        fullWidth={props.fullWidth}
        startDecorator={<AddRoundedIcon />}
        onClick={props.onAttachNew}
        sx={buttonAttachSx.desktop}
      >
        Note
      </Button>
    </Tooltip>
  );
}
