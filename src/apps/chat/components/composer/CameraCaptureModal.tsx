import * as React from 'react';

import { Box, Button, CircularProgress, IconButton, LinearProgress, Modal, ModalClose, Option, Select, Sheet, Typography } from '@mui/joy';
import DownloadIcon from '@mui/icons-material/Download';
import InfoIcon from '@mui/icons-material/Info';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { InlineError } from '~/common/components/InlineError';
import { useCameraCapture } from '~/common/components/useCameraCapture';


function renderVideoFrameToCanvas(videoElement: HTMLVideoElement): HTMLCanvasElement {
  // paint the video on a canvas, to save it
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(videoElement, 0, 0);
  return canvas;
}

function downloadVideoFrameAsPNG(videoElement: HTMLVideoElement) {
  // video to canvas to png
  const renderedFrame = renderVideoFrameToCanvas(videoElement);
  const imageDataURL = renderedFrame.toDataURL('image/png');

  // auto-download
  const link = document.createElement('a');
  link.download = 'image.png';
  link.href = imageDataURL;
  link.click();
}


export function CameraCaptureModal(props: { onCloseModal: () => void, onOCR: (ocrText: string) => void }) {
  // state
  const [ocrProgress, setOCRProgress] = React.useState<number | null>(null);
  const [showInfo, setShowInfo] = React.useState(false);

  // camera operations
  const {
    videoRef,
    cameras, cameraIdx, setCameraIdx,
    zoomControl, info, error,
    resetVideo,
  } = useCameraCapture();


  const stopAndClose = () => {
    resetVideo();
    props.onCloseModal();
  };

  const handleVideoOCRClicked = async () => {
    if (!videoRef.current) return;
    const renderedFrame = renderVideoFrameToCanvas(videoRef.current);

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
    stopAndClose();
    props.onOCR(result.data.text);
  };

  const handleVideoDownloadClicked = () => {
    if (!videoRef.current) return;
    downloadVideoFrameAsPNG(videoRef.current);
  };


  return (
    <Modal open onClose={stopAndClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      <Box sx={{
        display: 'flex', flexDirection: 'column', m: 1,
        borderRadius: 'md', overflow: 'hidden',
        boxShadow: 'sm',
      }}>

        {/* Top bar */}
        <Sheet variant='solid' invertedColors sx={{ zIndex: 10, display: 'flex', justifyContent: 'space-between', p: 1 }}>
          <Select
            variant='solid' color='neutral'
            value={cameraIdx} onChange={(_event: any, value: number | null) => setCameraIdx(value === null ? -1 : value)}
            indicator={<KeyboardArrowDownIcon />}
          >
            <Option value={-1}>
              No Camera
            </Option>
            {cameras.map((device: MediaDeviceInfo, camIndex) => (
              <Option key={'video-dev-' + camIndex} value={camIndex}>
                {device.label}
              </Option>
            ))}
          </Select>

          <ModalClose onClick={stopAndClose} sx={{ position: 'static' }} />
        </Sheet>

        {/* (main) Video */}
        <Box sx={{ position: 'relative' }}>
          <video
            ref={videoRef} autoPlay playsInline
            style={{
              display: 'block', width: '100%', maxHeight: 'calc(100vh - 200px)',
              background: '#8888', opacity: ocrProgress !== null ? 0.5 : 1,
            }}
          />

          {showInfo && !!info && <Typography
            sx={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1,
              background: 'rgba(0,0,0,0.5)', color: 'white',
              whiteSpace: 'pre', overflowY: 'scroll',
            }}>
            {info}
          </Typography>}

          {ocrProgress !== null && <CircularProgress sx={{ position: 'absolute', top: 'calc(50% - 34px / 2)', left: 'calc(50% - 34px / 2)', zIndex: 2 }} />}
        </Box>

        {/* Bottom controls (zoom, ocr, download) & progress */}
        <Sheet variant='soft' sx={{ display: 'flex', flexDirection: 'column', zIndex: 20, gap: 1, p: 1 }}>

          {!!error && <InlineError error={error} />}

          {zoomControl}

          {ocrProgress !== null && <LinearProgress color='primary' determinate value={100 * ocrProgress} sx={{ px: 2 }} />}

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'space-between' }}>
            <IconButton disabled={!info} variant='soft' color='neutral' size='lg' onClick={() => setShowInfo(info => !info)} sx={{ zIndex: 30 }}>
              <InfoIcon />
            </IconButton>
            <Button disabled={ocrProgress !== null} fullWidth variant='solid' size='lg' onClick={handleVideoOCRClicked} sx={{ flex: 1, maxWidth: 260 }}>
              Extract Text
            </Button>
            <IconButton variant='soft' color='neutral' size='lg' onClick={handleVideoDownloadClicked}>
              <DownloadIcon />
            </IconButton>
          </Box>
        </Sheet>

      </Box>
    </Modal>
  );
}