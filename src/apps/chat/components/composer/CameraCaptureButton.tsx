import * as React from 'react';
import { recognize } from 'tesseract.js';

import { Box, Button, CircularProgress, IconButton, LinearProgress, Modal, ModalClose, Option, Select, Sheet, Slider, Typography } from '@mui/joy';
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { hideOnDesktop, hideOnMobile } from '~/common/theme';

const isDevelopment = process.env.NODE_ENV === 'development';


export function CameraCaptureButton(props: { onOCR: (ocrText: string) => void }) {
  // state
  const [availableDevices, setAvailableDevices] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceIdx, setSelectedDeviceIdx] = React.useState<number | null>(null); // availableDevices[0
  const [open, setOpen] = React.useState(false);
  const [zoomControl, setZoomControl] = React.useState<React.ReactNode>(null);
  const [ocrProgress, setOCRProgress] = React.useState<number | null>(null);
  const [showInfo, setShowInfo] = React.useState(false);
  const [infoText, setInfoText] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // external state
  // const theme = useTheme();

  // device selection
  const selectedDevice = selectedDeviceIdx !== null ? availableDevices[selectedDeviceIdx] ?? null : null;


  // camera operations
  const startCamera = React.useCallback(async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && selectedDevice !== null) {
      // setTextDebug(JSON.stringify(navigator.mediaDevices.getSupportedConstraints(), null, 2));
      const constraints: MediaStreamConstraints & { video: { zoom: boolean } } = {
        video: {
          deviceId: selectedDevice.deviceId,
          width: { ideal: 1920 }, // or any desired width
          height: { ideal: 1440 }, // or any desired height
          frameRate: { ideal: 30 }, // or any desired frame rate
          zoom: true, // added for requesting zooming
        },
      };
      try {
        const stream: MediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoRef.current)
          videoRef.current.srcObject = stream;

        const [track] = stream.getVideoTracks();
        if (track) {
          // Get capabilities (for the zoom ranges)
          const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom: { min: number, max: number, step: number } };
          const settings = track.getSettings();
          setInfoText(`Settings: ${JSON.stringify(settings, null, 2)}\n\nCapabilities: ${JSON.stringify(capabilities, null, 2)}`);

          // Map zoom to a slider element.
          if (capabilities.zoom) {
            const { min, max, step } = capabilities.zoom;
            const control = <Box sx={{ display: 'flex', mx: 3 }}><Slider
              color='neutral'
              min={min} max={max} step={step} defaultValue={1}
              onChange={(event, value) => track.applyConstraints({ advanced: [{ zoom: value as number }] } as any)}
            /></Box>;
            setZoomControl(control);
          }
        }

      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    }
  }, [selectedDevice]);

  const stopCamera = React.useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);


  // effect to close/start camera on configuration changes

  React.useEffect(() => {
    if (open) startCamera().then(() => null);
    else stopCamera();

    // Cleanup function to stop the camera when the component unmounts
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);


  // effect to enumerate devices and auto-select the back camera (or the first camera)

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

  const handleDeviceSelected = (event: any, value: number | null) => setSelectedDeviceIdx(value);


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
    const result = await recognize(renderedFrame, undefined, {
      logger: m => {
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
      Recognize
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