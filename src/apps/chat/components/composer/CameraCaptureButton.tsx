import * as React from 'react';

import { Button, IconButton } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';

import { hideOnDesktop, hideOnMobile } from '~/common/theme';

import { CameraCaptureModal } from './CameraCaptureModal';

const showOnDesktop = false; // process.env.NODE_ENV === 'development';


export function CameraCaptureButton(props: { onOCR: (ocrText: string) => void }) {
  // state
  const [open, setOpen] = React.useState(false);

  return <>

    {/* The Button */}
    <IconButton variant='plain' color='neutral' onClick={() => setOpen(true)} sx={hideOnDesktop}>
      <AddAPhotoIcon />
    </IconButton>

    {/* Also show a button on desktop while in development */}
    {showOnDesktop && <Button
      fullWidth variant='plain' color='neutral' onClick={() => setOpen(true)} startDecorator={<AddAPhotoIcon />}
      sx={{ ...hideOnMobile, justifyContent: 'flex-start' }}>
      OCR
    </Button>}

    {/* The actual capture dialog, which will stream the video */}
    {open && <CameraCaptureModal onCloseModal={() => setOpen(false)} onOCR={props.onOCR} />}

  </>;
}