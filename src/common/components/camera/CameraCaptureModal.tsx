import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, IconButton, Modal, ModalClose, ModalSlotsAndSlotProps, Option, Select, SelectSlotsAndSlotProps, Sheet, Tooltip, Typography } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';
import CameraFrontIcon from '@mui/icons-material/CameraFront';
import CameraRearIcon from '@mui/icons-material/CameraRear';
import DownloadIcon from '@mui/icons-material/Download';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import FlipCameraAndroidOutlinedIcon from '@mui/icons-material/FlipCameraAndroidOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

import { InlineError } from '~/common/components/InlineError';
import { Is } from '~/common/util/pwaUtils';
import { animationBackgroundCameraFlash } from '~/common/util/animUtils';
import { downloadVideoFrame, renderVideoFrameAsFile } from '~/common/util/videoUtils';

import type { CameraCaptureResult } from './useCameraCapture';
import { useCameraCapture } from './useCameraCapture';


// configuration
const DEBUG_NO_CAMERA_OPTION = false;
const FLASH_DURATION_MS = 600;
const ADD_COOLDOWN_MS = 300;


const _modalSlotProps: ModalSlotsAndSlotProps['slotProps'] = {
  backdrop: {
    sx: {
      backdropFilter: 'none', // using none because this is heavy
      // backdropFilter: 'blur(4px)',
      // backgroundColor: 'rgba(11 13 14 / 0.75)',
      backgroundColor: 'rgba(var(--joy-palette-neutral-darkChannel) / 0.67)',
    },
  },
} as const;

const _selectSlotProps: SelectSlotsAndSlotProps<false>['slotProps'] = {
  listbox: {
    size: 'md',
  },
} as const;

const _styles = {

  modal: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  container: {
    display: 'flex', flexDirection: 'column', m: 1,
    borderRadius: 'md', overflow: 'hidden',
    boxShadow: 'lg',
  },

  topBar: {
    p: 1,
    backgroundColor: 'neutral.800',
    display: 'flex',
    justifyContent: 'space-between',
  },

  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  },

  cameraSelect: {
    background: 'transparent',
  },

  videoContainer: {
    position: 'relative',
    backgroundColor: 'background.level3',
  },

  infoOverlay: {
    position: 'absolute', inset: 0, zIndex: 1,
    background: 'rgba(0,0,0,0.5)', color: 'white',
    whiteSpace: 'pre', overflowY: 'scroll',
  },

  bottomBar: {
    p: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },

  captureButtonContainer: {
    display: 'flex',
    gap: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  captureButtonGroup: {
    '--ButtonGroup-separatorColor': 'none !important',
    // '--ButtonGroup-separatorSize': '2px',
    borderRadius: '3rem',
    // boxShadow: 'md',
    boxShadow: '0 8px 12px -6px rgb(var(--joy-palette-neutral-darkChannel) / 50%)',
  },

  addButton: {
    pl: 2.5,
    pr: 2,
  },

  captureButton: {
    backgroundColor: 'neutral.solidHoverBg',
    pl: 3.25,
    pr: 4.5,
    py: 1.5,
    minWidth: { md: 200 },
    '&:hover': {
      backgroundColor: 'neutral.plainHoverColor',
    },
  },

  recButtonLarge: {
    px: 4,
    py: 1.5,
    minWidth: { md: 200 },
  },

  recButtonRight: {
    pl: 2,
    pr: 2.5,
  },

} as const satisfies Record<string, SxProps>;


export function CameraCaptureModal(props: {
  allowMultiCapture?: boolean;
  allowLiveFeed?: boolean;
  liveFeedOnly?: boolean;
  // allowOcr?: boolean;
  onDone: (result: CameraCaptureResult | null) => void;
}) {

  // state
  const [showInfo, setShowInfo] = React.useState(false);
  const [isFlashing, setIsFlashing] = React.useState(false); // For flash effect
  const [isAddButtonDisabled, setIsAddButtonDisabled] = React.useState(false); // Cooldown state
  const [capturedCount, setCapturedCount] = React.useState(0);
  const capturedImagesRef = React.useRef<File[]>([]);

  // external state
  const {
    videoRef,
    cameras,
    cameraIdx,
    setCameraIdx,
    detachStream,
    zoomControl,
    info,
    error,
  } = useCameraCapture();


  // derived state
  const { allowMultiCapture, allowLiveFeed, liveFeedOnly, onDone } = props;


  // single exit point: gather results and close (stream cleanup happens via effect on unmount)
  const _resolveAndClose = React.useCallback((extraImage: undefined | File, includeLiveStream: boolean) => {
    const images = capturedImagesRef.current;
    if (extraImage)
      images.push(extraImage);
    const liveStream = includeLiveStream ? detachStream() ?? undefined : undefined;
    onDone(images.length > 0 || liveStream ? { images, liveStream } : null);
  }, [detachStream, onDone]);


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
      // resolve adding this file and with no livestream
      _resolveAndClose(file, false);
    } catch (error) {
      console.warn('[CameraCapture] Error capturing video frame:', error);
    }
  }, [_resolveAndClose, videoRef]);

  const handleVideoAddClicked = React.useCallback(async () => {
    if (!videoRef.current) return;
    try {
      handleFlashEffect(ADD_COOLDOWN_MS); // Trigger flash and cooldown
      const file = await renderVideoFrameAsFile(videoRef.current, 'camera', 'image/jpeg', 0.95);
      capturedImagesRef.current.push(file);
      setCapturedCount(c => c + 1);
    } catch (error) {
      console.warn('[CameraCapture] Error capturing video frame:', error);
    }
  }, [handleFlashEffect, videoRef]);

  const handleVideoDownloadClicked = React.useCallback(async () => {
    if (!videoRef.current) return;
    await downloadVideoFrame(videoRef.current, 'camera', 'image/jpeg', 0.98).catch(alert);
  }, [videoRef]);

  const handleStartLiveFeedClicked = React.useCallback(() => {
    // resolve with the detached livestream, and no extra images
    _resolveAndClose(undefined, true);
  }, [_resolveAndClose]);

  const handleCloseModal = React.useCallback(() => {
    // resolve with no extra images, no livestream - baseline just closes
    _resolveAndClose(undefined, false);
  }, [_resolveAndClose]);


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


  const cameraButtons = React.useMemo(() => {
    const btns: React.ReactNode[] = [];

    // Live-feed-only mode: single prominent red Record button
    if (liveFeedOnly) {
      btns.push(
        <Button key='rec' size='md' color='danger' disabled={cameraIdx === -1} onClick={handleStartLiveFeedClicked} endDecorator={<FiberManualRecordIcon />} sx={_styles.recButtonLarge}>
          Live Capture
        </Button>,
      );
      return btns;
    }

    // After first capture: [wide +] [Done (N)] - no confusing Capture
    if (capturedCount > 0) {
      btns.push(
        <Button key='add' size='lg' disabled={isAddButtonDisabled} onClick={handleVideoAddClicked} endDecorator={<CameraEnhanceIcon />} sx={{ ..._styles.captureButton, minWidth: 'unset', '--Button-gap': '0.25rem', px: 5 }}>
          +
        </Button>,
      );
      btns.push(
        <Button key='done' size='lg' variant='soft' onClick={handleCloseModal} sx={{ px: 3, py: 1.5 }}>
          Attach {capturedCount}
        </Button>,
      );
      return btns;
    }

    // Before any captures: [+] [Capture] [Live?]
    if (allowMultiCapture)
      btns.push(
        <Tooltip key='add' disableInteractive arrow placement='top' title='Add to message'>
          <IconButton size='sm' disabled={isAddButtonDisabled} onClick={handleVideoAddClicked} sx={_styles.addButton}>
            <AddRoundedIcon />
          </IconButton>
        </Tooltip>,
      );
    btns.push(
      <Button key='snap' size='lg' onClick={handleVideoSnapClicked} endDecorator={<CameraEnhanceIcon />} sx={_styles.captureButton}>
        Capture
      </Button>,
    );
    if (allowLiveFeed)
      btns.push(
        <Tooltip key='live' disableInteractive arrow placement='top' title='Start live feed'>
          <IconButton
            size='sm'
            color='danger'
            disabled={cameraIdx === -1}
            onClick={handleStartLiveFeedClicked}
            sx={_styles.recButtonRight}
          >
            <FiberManualRecordIcon />
          </IconButton>
        </Tooltip>,
      );
    return btns;
  }, [allowLiveFeed, allowMultiCapture, liveFeedOnly, cameraIdx, capturedCount, handleCloseModal, handleStartLiveFeedClicked, handleVideoAddClicked, handleVideoSnapClicked, isAddButtonDisabled]);


  return (
    <Modal
      open
      onClose={handleCloseModal}
      slotProps={_modalSlotProps}
      sx={_styles.modal}
    >

      <Box sx={_styles.container}>

        {/* Top bar */}
        <Sheet variant='solid' invertedColors={true} sx={_styles.topBar}>
          <Box sx={_styles.topBarLeft}>
            <Select
              size='sm'
              variant={displayCameras.length > 1 ? 'soft' : 'plain'}
              color='neutral'
              value={cameraIdx} onChange={(_event: any, value: number | null) => setCameraIdx(value === null ? -1 : value)}
              indicator={<KeyboardArrowDownIcon />}
              sx={_styles.cameraSelect}
              slotProps={_selectSlotProps}
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

          <ModalClose size='lg' onClick={handleCloseModal} sx={{ position: 'static' }} />
        </Sheet>

        {/* (main) Video */}
        <Box sx={_styles.videoContainer}>
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
            <Typography sx={_styles.infoOverlay}>
              {info}
            </Typography>
          )}

          {/*{ocrProgress !== null && <CircularProgress sx={{ position: 'absolute', top: 'calc(50% - 34px / 2)', left: 'calc(50% - 34px / 2)', zIndex: 2 }} />}*/}
        </Box>

        {/* Bottom controls (zoom, download) & progress */}
        <Sheet variant='soft' sx={_styles.bottomBar}>
          {!!error && <InlineError error={error} />}

          {zoomControl}

          {/*{ocrProgress !== null && <LinearProgress color='primary' determinate value={100 * ocrProgress} sx={{ px: 2 }} />}*/}

          <Box paddingBottom={zoomControl ? 1 : undefined} sx={_styles.captureButtonContainer}>

            {/* Info */}
            <IconButton disabled={!info} onClick={() => setShowInfo((prev) => !prev)}>
              <InfoOutlinedIcon />
            </IconButton>

            {/*<Button disabled={ocrProgress !== null} fullWidth variant='solid' size='lg' onClick={handleVideoOCRClicked} sx={{ flex: 1, maxWidth: 260 }}>*/}
            {/*  Extract Text*/}
            {/*</Button>*/}

            {/* Capture */}
            <ButtonGroup variant='solid' sx={_styles.captureButtonGroup}>
              {cameraButtons}
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