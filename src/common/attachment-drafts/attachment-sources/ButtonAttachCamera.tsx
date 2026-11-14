import * as React from 'react';

import { Box, Button, ColorPaletteProp, IconButton, Tooltip } from '@mui/joy';

import { buttonAttachSx } from '~/common/components/ButtonAttachFiles';
import { PhCamera } from '~/common/components/icons/phosphor/PhCamera';


export const ButtonAttachCameraMemo = React.memo(ButtonAttachCamera);

function ButtonAttachCamera(props: {
  color?: ColorPaletteProp,
  isMobile?: boolean,
  disabled?: boolean,
  fullWidth?: boolean,
  noToolTip?: boolean,
  onOpenCamera: () => void,
}) {
  return props.isMobile ? (
    <IconButton color={props.color} disabled={props.disabled} onClick={props.onOpenCamera}>
      <PhCamera />
    </IconButton>
  ) : (
    <Tooltip arrow disableInteractive placement='top-start' title={props.noToolTip ? null : (
      <Box sx={buttonAttachSx.tooltip}>
        <b>Attach photo</b><br />
        {!!props.isMobile ? 'Auto-OCR to read text' : 'See the world, on the go'}
      </Box>
    )}>
      <Button
        variant={props.color ? 'soft' : 'plain'}
        color={props.color || 'neutral'}
        disabled={props.disabled}
        fullWidth={props.fullWidth}
        startDecorator={<PhCamera />}
        onClick={props.onOpenCamera}
        sx={buttonAttachSx.desktop}
      >
        Camera
      </Button>
    </Tooltip>
  );
}
