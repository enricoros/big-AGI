import * as React from 'react';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import CameraAltOutlinedIcon from '@mui/icons-material/CameraAltOutlined';

import { CameraCaptureModal } from '../CameraCaptureModal';


const attachCameraLegend = (isMobile: boolean) =>
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    <b>Attach photo</b><br />
    {isMobile ? 'Auto-OCR to read text' : 'See the world, on the go'}
  </Box>;


export const ButtonAttachCameraMemo = React.memo(ButtonAttachCamera);

function ButtonAttachCamera(props: { isMobile?: boolean, onOpenCamera: () => void }) {
  return props.isMobile ? (
    <IconButton onClick={props.onOpenCamera}>
      <AddAPhotoIcon />
    </IconButton>
  ) : (
    <Tooltip disableInteractive variant='solid' placement='top-start' title={attachCameraLegend(!!props.isMobile)}>
      <Button fullWidth variant='plain' color='neutral' onClick={props.onOpenCamera} startDecorator={<CameraAltOutlinedIcon />}
              sx={{ justifyContent: 'flex-start' }}>
        Camera
      </Button>
    </Tooltip>
  );
}

export function useCameraCaptureModal(onAttachImage: (file: File) => void) {

  // state
  const [open, setOpen] = React.useState(false);

  const openCamera = React.useCallback(() => setOpen(true), []);

  const cameraCaptureComponent = React.useMemo(() => open && (
    <CameraCaptureModal
      onCloseModal={() => setOpen(false)}
      onAttachImage={onAttachImage}
    />
  ), [open, onAttachImage]);

  return {
    openCamera,
    cameraCaptureComponent,
  };
}