import * as React from 'react';

import { Button, IconButton } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';

import { CameraCaptureModal } from './CameraCaptureModal';

const CAMERA_ENABLE_ON_DESKTOP = false;


export function ButtonCameraCapture(props: { isMobile: boolean, onOCR: (ocrText: string) => void }) {
  // state
  const [open, setOpen] = React.useState(false);

  return <>

    {/* The Button */}
    {props.isMobile ? (
      <IconButton variant='plain' color='neutral' onClick={() => setOpen(true)}>
        <AddAPhotoIcon />
      </IconButton>
    ) : CAMERA_ENABLE_ON_DESKTOP ? (
      <Button
        fullWidth variant='plain' color='neutral' onClick={() => setOpen(true)} startDecorator={<AddAPhotoIcon />}
        sx={{ justifyContent: 'flex-start' }}>
        OCR
      </Button>
    ) : undefined}

    {/* The actual capture dialog, which will stream the video */}
    {open && <CameraCaptureModal onCloseModal={() => setOpen(false)} onOCR={props.onOCR} />}

  </>;
}