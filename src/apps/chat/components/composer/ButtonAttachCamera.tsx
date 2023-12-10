import * as React from 'react';

import { Box, Button, IconButton, Tooltip } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';

import { CameraCaptureModal } from './CameraCaptureModal';


const attachCameraLegend = (isMobile: boolean) =>
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    <b>Attach photo</b><br />
    {isMobile ? 'Auto-OCR to read text' : 'See the world, on the go'}
  </Box>;


export const ButtonAttachCameraMemo = React.memo(ButtonAttachCamera);

function ButtonAttachCamera(props: { isMobile?: boolean, onAttachImage: (file: File) => void }) {
  // state
  const [open, setOpen] = React.useState(false);

  return <>

    {/* The Button */}
    {props.isMobile ? (
      <IconButton variant='plain' color='neutral' onClick={() => setOpen(true)}>
        <AddAPhotoIcon />
      </IconButton>
    ) : (
      <Tooltip variant='solid' placement='top-start' title={attachCameraLegend(!!props.isMobile)}>
        <Button fullWidth variant='plain' color='neutral' onClick={() => setOpen(true)} startDecorator={<AddAPhotoIcon />}
                sx={{ justifyContent: 'flex-start' }}>
          Camera
        </Button>
      </Tooltip>
    )}

    {/* The actual capture dialog, which will stream the video */}
    {open && (
      <CameraCaptureModal
        onCloseModal={() => setOpen(false)}
        onAttachImage={props.onAttachImage}
      />
    )}

  </>;
}