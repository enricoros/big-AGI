import * as React from 'react';

import { Button, IconButton } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';

import { CameraCaptureModal } from './CameraCaptureModal';


export function ButtonCameraCapture(props: { isMobile?: boolean, onAttachImage: (file: File) => void }) {
  // state
  const [open, setOpen] = React.useState(false);

  return <>

    {/* The Button */}
    {props.isMobile ? (
      <IconButton variant='plain' color='neutral' onClick={() => setOpen(true)}>
        <AddAPhotoIcon />
      </IconButton>
    ) : (
      <Button
        fullWidth variant='plain' color='neutral' onClick={() => setOpen(true)} startDecorator={<AddAPhotoIcon />}
        sx={{ justifyContent: 'flex-start' }}>
        Camera
      </Button>
    )}

    {/* The actual capture dialog, which will stream the video */}
    {open && <CameraCaptureModal onCloseModal={() => setOpen(false)} onAttachImage={props.onAttachImage} />}

  </>;
}