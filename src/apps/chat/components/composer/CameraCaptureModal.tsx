import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, IconButton, Modal, ModalClose, Option, Select, Sheet, Tooltip, Typography } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';
import CameraFrontIcon from '@mui/icons-material/CameraFront';
import CameraRearIcon from '@mui/icons-material/CameraRear';
import DownloadIcon from '@mui/icons-material/Download';
import FlipCameraAndroidOutlinedIcon from '@mui/icons-material/FlipCameraAndroidOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { InlineError } from '~/common/components/InlineError';
import { Is } from '~/common/util/pwaUtils';
import { animationBackgroundCameraFlash } from '~/common/util/animUtils';
import { downloadVideoFrame, renderVideoFrameAsFile } from '~/common/util/videoUtils';
import { useCameraCapture } from '~/common/components/useCameraCapture';


// configuration
const DEBUG_NO_CAMERA_OPTION = false;
const FLASH_DURATION_MS = 600;
const ADD_COOLDOWN_MS = 300;


const captureButtonContainerSx: SxProps = {
  display: 'flex',
  gap: 1,
  justifyContent: 'space-between',
  alignItems: 'center',
};

const captureButtonGroupSx: SxProps = {
  '--ButtonGroup-separatorColor': 'none !important',
  // '--ButtonGroup-separatorSize': '2px',
  borderRadius: '3rem',
  // boxShadow: 'md',
  boxShadow: '0 8px 12px -6px rgb(var(--joy-palette-neutral-darkChannel) / 50%)',
};

const captureButtonSx: SxProps = {
  backgroundColor: 'neutral.solidHoverBg',
  pl: 3.25,
  pr: 4.5,
  py: 1.5,
  minWidth: { md: 200 },
  '&:hover': {
    backgroundColor: 'neutral.plainHoverColor',
  },
};

const addButtonSx: SxProps = {
  pl: 2.5,
  pr: 2,
};


export function CameraCaptureModal(props: {
  onCloseModal: () => void;
  onAttachImage: (file: File) => void;
  // onOCR: (ocrText: string) => void }
}) {

  // state
  const [showInfo, setShowInfo] = React.useState(false);
  const [isFlashing, setIsFlashing] = React.useState(false); // For flash effect
  const [isAddButtonDisabled, setIsAddButtonDisabled] = React.useState(false); // Cooldown state

  // external state
  const {
    videoRef,
    cameras, cameraIdx, setCameraIdx,
    zoomControl, info, error,
    resetVideo,
  } = useCameraCapture();


  // derived state
  const { onCloseModal, onAttachImage } = props;


  const stopAndClose = React.useCallback(() => {
    resetVideo();
    onCloseModal();
  }, [onCloseModal, resetVideo]);


  const handleFlashEffect = React.useCallback((cooldownMs: number) => {
    // Flash effect
    setIsFlashing(true);
    setTimeout(() => {
      setIsFlashing(false);
    }, FLASH_DURATION_MS); // Flash duration in milliseconds

    // Cooldown
    if (cooldownMs) {
      setIsAddButtonDisabled(true);
      setTimeout(() => {
        setIsAddButtonDisabled(false);
      }, cooldownMs);
    }
  }, []);

  const handleVideoSnapClicked = React.useCallback(async () => {
    if (!videoRef.current) return;
    try {
      // handleFlashEffect(0); // Trigger flash
      const file = await renderVideoFrameAsFile(videoRef.current, 'camera', 'image/jpeg', 0.95);
      onAttachImage(file);
      stopAndClose();
    } catch (error) {
      console.error('Error capturing video frame:', error);
    }
  }, [onAttachImage, stopAndClose, videoRef]);

  const handleVideoAddClicked = React.useCallback(async () => {
    if (!videoRef.current) return;
    try {
      handleFlashEffect(ADD_COOLDOWN_MS); // Trigger flash and cooldown
      const file = await renderVideoFrameAsFile(videoRef.current, 'camera', 'image/jpeg', 0.95);
      onAttachImage(file);
    } catch (error) {
      console.error('Error capturing video frame:', error);
    }
  }, [handleFlashEffect, onAttachImage, videoRef]);

  const handleVideoDownloadClicked = React.useCallback(async () => {
    if (!videoRef.current) return;
    await downloadVideoFrame(videoRef.current, 'camera', 'image/jpeg', 0.98);
  }, [videoRef]);


  // Reduced set of cameras

  const displayCameras = React.useMemo(() => {
    // iOS/English: "Front Camera", "Back Camera"
    if (Is.OS.iOS) {
      let reducedCameras = cameras.filter((device) => ['Front Camera', 'Back Camera'].includes(device.label));
      if (reducedCameras.length > 0)
        return reducedCameras;
    }
    return cameras;
  }, [cameras]);

  const { canSwitchCameras, isFrontCamera, isBackCamera } = React.useMemo(() => {

    // determine if the current device is a front or back camera
    let isFrontCamera = false;
    let isBackCamera = false;
    if (cameraIdx !== -1) {
      const currentDevice = displayCameras[cameraIdx];
      if (currentDevice) {
        isFrontCamera = currentDevice.label.includes('Front Camera') || currentDevice.label.toLowerCase().includes('front');
        isBackCamera = currentDevice.label.includes('Back Camera') || currentDevice.label.toLowerCase().includes('back');
      }
    }

    // quick out if we only have 1 or 0 cameras
    if (displayCameras.length <= 1)
      return { canSwitchCameras: false, isFrontCamera, isBackCamera };

    // use a reduction to find both the front and back cameras
    const foundCameras = displayCameras.reduce((acc, device) => {
      if (acc.front && acc.back) return acc;
      if (device.label.includes('Front Camera')) acc.front = true;
      else if (device.label.toLowerCase().includes('front')) acc.front = true;
      if (device.label.includes('Back Camera')) acc.back = true;
      else if (device.label.toLowerCase().includes('back')) acc.back = true;
      return acc;
    }, { front: false, back: false });

    return { canSwitchCameras: (foundCameras.front && foundCameras.back) || displayCameras.length === 2, isFrontCamera, isBackCamera };
  }, [cameraIdx, displayCameras]);

  const handleCameraSwitch = React.useCallback(() => {

    // safety checks: has multiple cameras, and current camera is valid
    if (displayCameras.length <= 1 || cameraIdx === -1) return;
    const currentCamera = displayCameras[cameraIdx] || undefined;
    if (!currentCamera) return;

    // finds the camera to switch to
    let nextIdx: number | undefined = undefined;

    // iOS
    if (currentCamera.label.includes('Front Camera'))
      nextIdx = displayCameras.findIndex((device) => device.label.includes('Back Camera'));
    else if (currentCamera.label.includes('Back Camera'))
      nextIdx = displayCameras.findIndex((device) => device.label.includes('Front Camera'));

    // Android
    if (nextIdx === undefined && currentCamera.label.includes('facing front'))
      nextIdx = displayCameras.map((device) => device.label).findLastIndex((label) => label.includes('facing back'));
    else if (nextIdx === undefined && currentCamera.label.includes('facing back'))
      nextIdx = displayCameras.map((device) => device.label).findLastIndex((label) => label.includes('facing front'));

    // Generic: if we have 2 cameras, flip to the other one
    if (nextIdx === undefined && displayCameras.length === 2)
      nextIdx = cameraIdx === 0 ? 1 : 0;

    // if we found a valid camera, switch to it
    if (nextIdx !== undefined && nextIdx !== -1)
      setCameraIdx(nextIdx);
  }, [cameraIdx, displayCameras, setCameraIdx]);


  return (
    <Modal
      open
      onClose={stopAndClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'none', // using none because this is heavy
            // backdropFilter: 'blur(4px)',
            // backgroundColor: 'rgba(11 13 14 / 0.75)',
            backgroundColor: 'rgba(var(--joy-palette-neutral-darkChannel) / 0.5)',
          },
        },
      }}
    >

      <Box sx={{
        display: 'flex', flexDirection: 'column', m: 1,
        borderRadius: 'md', overflow: 'hidden',
        boxShadow: 'lg',
      }}>

        {/* Top bar */}
        <Sheet variant='solid' invertedColors={true} sx={{
          p: 1,
          backgroundColor: 'neutral.800',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Select
              size='sm'
              variant={displayCameras.length > 1 ? 'soft' : 'plain'}
              color='neutral'
              value={cameraIdx} onChange={(_event: any, value: number | null) => setCameraIdx(value === null ? -1 : value)}
              indicator={<KeyboardArrowDownIcon />}
              sx={{ background: 'transparent' }}
              slotProps={{ listbox: { size: 'md' } }}
            >
              {(!displayCameras.length || DEBUG_NO_CAMERA_OPTION) && (
                <Option key='video-dev-none' value={-1}>
                  No Camera
                </Option>
              )}
              {displayCameras.map((device: MediaDeviceInfo, camIndex) => (
                <Option key={'video-dev-' + camIndex} value={camIndex}>
                  {/*{device.label?.includes('Face') ? <CameraFrontIcon />*/}
                  {/*  : device.label?.includes('tual') ? <CameraRearIcon />*/}
                  {/*    : null}*/}
                  {device.label
                    ?.replace('camera2 ', 'Camera ')
                    .replace('facing front', 'Front')
                    .replace('facing back', 'Back')}
                </Option>
              ))}
            </Select>

            {canSwitchCameras && (
              <IconButton size='sm' onClick={handleCameraSwitch}>
                {isFrontCamera ? <CameraRearIcon /> : isBackCamera ? <CameraFrontIcon /> : <FlipCameraAndroidOutlinedIcon />}
              </IconButton>
            )}
          </Box>

          <ModalClose size='lg' onClick={stopAndClose} sx={{ position: 'static' }} />
        </Sheet>

        {/* (main) Video */}
        <Box sx={{ position: 'relative', backgroundColor: 'background.level3' }}>
          <video
            ref={videoRef} autoPlay playsInline
            style={{
              display: 'block',
              width: !Is.Browser.Safari ? '100%' : undefined,
              marginLeft: 'auto', marginRight: 'auto',
              maxHeight: 'calc(100vh - 200px)',
              background: '#8888', //opacity: ocrProgress !== null ? 0.5 : 1,
            }}
          />

          {/* Flash overlay */}
          {isFlashing && (
            <Box
              sx={{
                position: 'absolute', inset: 0, zIndex: 2,
                animation: `${animationBackgroundCameraFlash} ${FLASH_DURATION_MS / 1000}s`,
              }}
            />
          )}

          {showInfo && !!info && (
            <Typography
              sx={{
                position: 'absolute', inset: 0, zIndex: 1, /* camera info on top of video */
                background: 'rgba(0,0,0,0.5)', color: 'white',
                whiteSpace: 'pre', overflowY: 'scroll',
              }}>
              {info}
            </Typography>
          )}

          {/*{ocrProgress !== null && <CircularProgress sx={{ position: 'absolute', top: 'calc(50% - 34px / 2)', left: 'calc(50% - 34px / 2)', zIndex: 2 }} />}*/}
        </Box>

        {/* Bottom controls (zoom, download) & progress */}
        <Sheet
          variant='soft'
          sx={{
            p: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {!!error && <InlineError error={error} />}

          {zoomControl}

          {/*{ocrProgress !== null && <LinearProgress color='primary' determinate value={100 * ocrProgress} sx={{ px: 2 }} />}*/}

          <Box paddingBottom={zoomControl ? 1 : undefined} sx={captureButtonContainerSx}>

            {/* Info */}
            <IconButton disabled={!info} onClick={() => setShowInfo((prev) => !prev)}>
              <InfoOutlinedIcon />
            </IconButton>

            {/*<Button disabled={ocrProgress !== null} fullWidth variant='solid' size='lg' onClick={handleVideoOCRClicked} sx={{ flex: 1, maxWidth: 260 }}>*/}
            {/*  Extract Text*/}
            {/*</Button>*/}

            {/* Capture */}
            <ButtonGroup variant='solid' sx={captureButtonGroupSx}>
              <Tooltip disableInteractive arrow placement='top' title='Add to message'>
                <IconButton size='sm' disabled={isAddButtonDisabled} onClick={handleVideoAddClicked} sx={addButtonSx}>
                  <AddRoundedIcon />
                </IconButton>
              </Tooltip>
              <Button size='lg' onClick={handleVideoSnapClicked} endDecorator={<CameraEnhanceIcon />} sx={captureButtonSx}>
                Capture
              </Button>
            </ButtonGroup>

            {/* Download */}
            <IconButton onClick={handleVideoDownloadClicked}>
              <DownloadIcon />
            </IconButton>

          </Box>
        </Sheet>

      </Box>
    </Modal>
  );
}