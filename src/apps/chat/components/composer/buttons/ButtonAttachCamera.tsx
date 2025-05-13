import * as React from 'react';

import { Box, Button, ColorPaletteProp, IconButton, Tooltip } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';

import { buttonAttachSx } from '~/common/components/ButtonAttachFiles';

import { CameraCaptureModal } from '../CameraCaptureModal';


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
      <AddAPhotoIcon />
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
        startDecorator={<CameraAltOutlinedIcon />}
        onClick={props.onOpenCamera}
        sx={buttonAttachSx.desktop}
      >
        Camera
      </Button>
    </Tooltip>
  );
}

export function useCameraCaptureModalDialog(onAttachImageStable: (file: File) => void) {

  // state
  const [open, setOpen] = React.useState(false);

  const openCamera = React.useCallback(() => setOpen(true), []);

  const cameraCaptureComponent = React.useMemo(() => open && (
    <CameraCaptureModal
      onCloseModal={() => setOpen(false)}
      onAttachImage={onAttachImageStable}
    />
  ), [open, onAttachImageStable]);

  return {
    openCamera,
    cameraCaptureComponent,
  };
}