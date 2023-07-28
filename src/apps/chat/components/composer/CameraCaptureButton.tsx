import * as React from 'react';

import { Box, Button, CircularProgress, IconButton, LinearProgress, Modal, ModalClose, Option, Select, Sheet, Typography } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { hideOnDesktop, hideOnMobile } from '~/common/theme';

import { useCamera } from '~/common/components/useCamera';

const isDevelopment = process.env.NODE_ENV === 'development';


export function CameraCaptureButton(props: { onOCR: (ocrText: string) => void }) {
  // state
  const [availableDevices, setAvailableDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIdx, setSelectedDeviceIdx] = React.useState<number | null>(null); // availableDevices[0
  const [open, setOpen] = React.useState(false);
  const [ocrProgress, setOCRProgress] = React.useState<number | null>(null);
  const [showInfo, setShowInfo] = React.useState(false);

  // external state
  // const theme = useTheme();

  // device selection
  const selectedDevice = selectedDeviceIdx !== null ? availableDevices[selectedDeviceIdx] ?? null : null;
  const { startCamera, stopCamera, infoText, zoomControl, videoRef } = useCamera(selectedDevice);

  // close/stream camera on configuration changes
  React.useEffect(() => {
    if (open) startCamera().then(() => null);
    else stopCamera();

    // Cleanup function to stop the camera when the component unmounts
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);


  // enumerate devices and auto-select the back camera (or the first camera)
  React.useEffect(() => {
    // do this only once, ever
    if (navigator.mediaDevices)
      navigator.mediaDevices.enumerateDevices().then(
        (devices) => {
          const mediaDeviceInfos = devices.filter(device => device.kind === 'videoinput');
          setAvailableDevices(mediaDeviceInfos);
          // auto-select the last device that ends with 'facing back', or the first device
          if (mediaDeviceInfos.length > 0) {
            const idx = mediaDeviceInfos.map(device => device.label).findLastIndex(label => label.toLowerCase().endsWith('facing back'));
            setSelectedDeviceIdx(idx >= 0 ? idx : 0);
          }
        });
  }, []);


  // dialog operations

  const handleCameraButtonClicked = () => setOpen(true);

  const handleCloseDialog = () => {
    stopCamera();
    setOpen(false);
  };

  const handleDeviceSelected = (_event: any, value: number | null) => setSelectedDeviceIdx(value);

  const renderVideoFrameToCanvas = (): HTMLCanvasElement => {
    // paint the video on a canvas, to save it
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current?.videoWidth || 640;
    canvas.height = videoRef.current?.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current as HTMLVideoElement, 0, 0);
    return canvas;
  };

  const handleReadTextClicked = async () => {
    if (!videoRef.current) return;
    const renderedFrame = renderVideoFrameToCanvas();

    setOCRProgress(0);
    const { recognize } = await import('tesseract.js');
    const result = await recognize(renderedFrame, undefined, {
      logger: m => {
        // noinspection SuspiciousTypeOfGuard
        if (typeof m.progress === 'number')
          setOCRProgress(m.progress);
      },
      errorHandler: e => console.error(e),
    });
    setOCRProgress(null);
    handleCloseDialog();
    props.onOCR(result.data.text);
  };

  const handleDownloadClicked = () => {
    // video to canvas to png
    const renderedFrame = renderVideoFrameToCanvas();
    const imageDataURL = renderedFrame.toDataURL('image/png');

    // auto-download
    const link = document.createElement('a');
    link.download = 'image.png';
    link.href = imageDataURL;
    link.click();
  };

  return <>

    {/* The Button */}
    <IconButton variant='plain' color='neutral' onClick={handleCameraButtonClicked} sx={hideOnDesktop}>
      <AddAPhotoIcon />
    </IconButton>
    {/* Also show a button on desktop while in development */}
    {isDevelopment && <Button
      fullWidth variant='plain' color='neutral' onClick={handleCameraButtonClicked} startDecorator={<AddAPhotoIcon />}
      sx={{ ...hideOnMobile, justifyContent: 'flex-start' }}>
      OCR
    </Button>}

    {/* The actual Capture Dialog */}
    <Modal open={open} onClose={handleCloseDialog} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Sheet variant='plain' sx={{ display: 'flex', flexDirection: 'column', background: 'transparent', m: 1, gap: 1 }}>

        <Box sx={{ zIndex: 10, display: 'flex', justifyContent: 'space-between' }}>
          <Select
            variant='solid' color='neutral' size='md'
            value={selectedDeviceIdx} onChange={handleDeviceSelected}
            indicator={<KeyboardArrowDownIcon />}
          >
            {availableDevices.map((device: MediaDeviceInfo, key) => (
              <Option key={'device-' + key} value={key}>
                {device.label}
              </Option>
            ))}
          </Select>

          <ModalClose onClick={handleCloseDialog} sx={{ position: 'static' }} />
        </Box>

        <Box sx={{ position: 'relative' }}>
          <video ref={videoRef} autoPlay playsInline style={{ display: 'block', width: '100%', maxHeight: 'calc(100vh - 200px)' }} />

          {showInfo && !!infoText && <Typography
            sx={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
              background: 'rgba(0,0,0,0.5)', color: 'white',
              whiteSpace: 'pre', overflowY: 'scroll',
            }}>
            {infoText}
          </Typography>}

          {ocrProgress !== null && <CircularProgress sx={{ position: 'absolute', top: 'calc(50% - 34px / 2)', left: 'calc(50% - 34px / 2)', zIndex: 2 }} />}
        </Box>

        {zoomControl}

        {ocrProgress !== null && <LinearProgress color='success' determinate value={100 * ocrProgress} sx={{ px: 2 }} />}

        <Box sx={{ display: 'flex', zIndex: 20, gap: 1 }}>
          <IconButton disabled={!infoText} variant='plain' color='neutral' size='lg' onClick={() => setShowInfo(info => !info)} sx={{ zIndex: 30 }}>
            <InfoIcon />
          </IconButton>

          <Button disabled={ocrProgress !== null} fullWidth variant='solid' size='lg' onClick={handleReadTextClicked} sx={{ flexGrow: 1 }}>
            Read Text
          </Button>

          <IconButton variant='plain' color='neutral' size='lg' onClick={handleDownloadClicked}>
            <DownloadIcon />
          </IconButton>
        </Box>

      </Sheet>
    </Modal>
  </>;
}