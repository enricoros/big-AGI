import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Slider } from '@mui/joy';
import ZoomInIcon from '@mui/icons-material/ZoomIn';

import { Is } from '~/common/util/pwaUtils';


// we need to use local state to avoid race conditions with start/stops (triggered by react/strict mode)
let currMediaStream: MediaStream | null = null;


/**
 * `useCameraCapture` is our React hook for interacting with a camera device.
 *
 * It accepts a MediaDeviceInfo object representing the selected device,
 * and returns an object containing states and methods for controlling the camera.
 *
 * Be sure to set the video ref to the video element in your component.
 */
export function useCameraCapture() {

  // state
  const [cameras, setCameras] = React.useState<MediaDeviceInfo[]>([]);
  const [cameraIdx, setCameraIdx] = React.useState<number>(-1);
  const [zoomControl, setZoomControl] = React.useState<React.ReactNode>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);


  // stop the video stream
  const resetVideo = React.useCallback(() => {
    if (currMediaStream) {
      const tracks = currMediaStream.getTracks();
      tracks.forEach((track) => track.stop());
      currMediaStream = null;
    } else
      console.log('stopVideo: no video stream to stop');
    if (videoRef.current)
      videoRef.current.srcObject = null;
    setZoomControl(null);
    setError(null);
  }, []);

  // Function to enumerate devices and update the camera list
  const enumerateCameras = React.useCallback(() => {
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {

        // get video devices
        const newVideoDevices = devices.filter((device) => device.kind === 'videoinput');
        setCameras(newVideoDevices);

        // auto-select the last device 'facing back', or the first device
        if (newVideoDevices.length > 0) {
          const newBackCamIdx = newVideoDevices
            .map((device) => device.label)
            .findLastIndex((label) => {
              if (Is.OS.iOS) return label.toLowerCase().includes('back camera');
              return label.toLowerCase().includes('back') || label.toLowerCase().includes('rear');
            });
          setCameraIdx((prevIdx) => (prevIdx === -1 ? (newBackCamIdx >= 0 ? newBackCamIdx : 0) : prevIdx));
        } else {
          setCameraIdx(-1);
          setError('No cameras found');
        }
      })
      .catch((error) => {
        console.warn('[DEV] useCameraCapture: enumerateDevices error:', error);
        setError(error.message);
      });
  }, []);

  // (once) enumerate video devices
  React.useEffect(() => {
    if (!navigator.mediaDevices) return;

    // Initial enumeration of devices
    enumerateCameras();

    // Listen for permission changes
    const permissionName = 'camera' as PermissionName;
    if (navigator.permissions?.query)
      navigator.permissions
        .query({ name: permissionName })
        .then((permissionStatus) => {
          permissionStatus.onchange = () => {
            // re-enumerate devices if permission changes
            if (permissionStatus.state === 'granted' || permissionStatus.state === 'prompt')
              enumerateCameras();
          };
        })
        .catch((error) => {
          console.warn('[DEV] useCameraCapture: permissions error:', error);
        });

    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', enumerateCameras);
    return () => navigator.mediaDevices.removeEventListener('devicechange', enumerateCameras);
  }, [enumerateCameras]);

  // auto start the camera when the cameraIdx changes, and stop on unmount
  React.useEffect(() => {

    // do nothing if no device is selected
    const selectedDevice = cameraIdx !== -1 ? cameras[cameraIdx] ?? null : null;
    if (selectedDevice === null) return;

    // start the camera if we have a selected device
    setError(null);
    setInfo(null);
    setZoomControl(null);
    _startVideo(selectedDevice, videoRef)
      .then(({ info, zoomControl }) => {
        setInfo(info);
        setZoomControl(zoomControl);
      })
      .catch((error) => {
        setError(error.message);
      });

    return () => resetVideo();
  }, [cameraIdx, cameras, resetVideo]);


  return {
    // the html video element
    videoRef,
    // list and select camera
    cameras,
    cameraIdx,
    setCameraIdx,
    zoomControl,
    info,
    error,
    resetVideo,
  };
}


const sliderContainerSx: SxProps = {
  fontSize: 'sm',
  display: 'flex',
  alignItems: 'center',
  mx: 0.75,
  gap: 3,
};


async function _startVideo(selectedDevice: MediaDeviceInfo, videoRef: React.RefObject<HTMLVideoElement>) {

  if (!selectedDevice || !navigator.mediaDevices?.getUserMedia)
    throw new Error('Browser has no camera access');

  const searchConstraints: MediaStreamConstraints & { video: { zoom: boolean } } = {
    video: {
      deviceId: selectedDevice.deviceId,
      width: { ideal: 1920 }, // or any desired width
      height: { ideal: 1440 }, // or any desired height
      frameRate: { ideal: 30 }, // or any desired frame rate
      zoom: true, // added for requesting zooming
    },
  };

  let stream: MediaStream;
  let track: MediaStreamTrack;
  try {
    // find the media stream
    stream = await navigator.mediaDevices.getUserMedia(searchConstraints);

    // attach it to the Video html element (will begin playing)
    if (videoRef?.current)
      videoRef.current.srcObject = stream;

    // get the video track
    [track] = stream.getVideoTracks();
  } catch (error: any) {
    console.log('useCameraCapture: startVideo error:', error);
    throw (error.name === 'NotAllowedError') ? new Error('Camera access denied, please grant permissions.') : error;
  }

  if (!track)
    throw new Error('No video track found');

  // assume we started it
  currMediaStream = stream;

  // Get capabilities (for the zoom ranges)
  const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom: { min: number; max: number; step: number } };
  const settings = track.getSettings();

  // Map zoom to a slider element.
  let zoomControl: React.ReactNode | null = null;
  if (capabilities.zoom) {
    const { min, max, step } = capabilities.zoom;
    zoomControl = (
      <Box sx={sliderContainerSx}>
        <span>Zoom:</span>
        <Slider
          variant='solid'
          color='neutral'
          size='lg'
          defaultValue={1}
          min={min} max={max} step={step}
          onChange={(_event, value) => track.applyConstraints({ advanced: [{ zoom: value as number }] } as any)}
        />
        <ZoomInIcon opacity={0.5} />
      </Box>
    );
  }

  return {
    info: `Settings: ${JSON.stringify(settings, null, 2)}\n\nCapabilities: ${JSON.stringify(capabilities, null, 2)}`,
    zoomControl: zoomControl,
  };
}
