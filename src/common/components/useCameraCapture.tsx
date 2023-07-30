import * as React from 'react';

import { Box, Slider, Typography } from '@mui/joy';


// we need to use local state to avoid race conditions with start/stops (triggred by react/strict mode)
let currMediaStream: MediaStream | null = null;


/**
 * `useCamera` is our React hook for interacting with a camera device.
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
      tracks.forEach(track => track.stop());
      currMediaStream = null;
    } else
      console.log('stopVideo: no video stream to stop');
    if (videoRef.current)
      videoRef.current.srcObject = null;
    setZoomControl(null);
    setError(null);
  }, []);


  // (once) enumerate video devices and auto-select the back-facing camera
  React.useEffect(() => {
    if (!navigator.mediaDevices) return;
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      // get video devices
      const newVideoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(newVideoDevices);

      // auto-select the last device 'facing back', or the first device
      if (newVideoDevices.length > 0) {
        const idx = newVideoDevices.map(device => device.label).findLastIndex(label => label.toLowerCase().endsWith('facing back'));
        setCameraIdx(idx >= 0 ? idx : 0);
      } else {
        setCameraIdx(-1);
        setError('No cameras found');
      }
    });
  }, []);

  // auto start the camera when the cameraIdx changes, and stop on unmount
  React.useEffect(() => {

    // do nothing if no device is selected
    const selectedDevice = cameraIdx !== -1 ? cameras[cameraIdx] ?? null : null;
    if (selectedDevice === null) return;

    // start the camera if we have a selected device
    setError(null);
    setInfo(null);
    setZoomControl(null);
    startVideo(selectedDevice, videoRef)
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
    cameras, cameraIdx, setCameraIdx,
    zoomControl, info, error,
    resetVideo,
  };
}


async function startVideo(selectedDevice: MediaDeviceInfo, videoRef: React.RefObject<HTMLVideoElement>) {
  if (!selectedDevice || !navigator.mediaDevices?.getUserMedia)
    throw new Error('Browser has no camera access');

  console.log('startVideo', { selectedDevice });

  const searchConstrants: MediaStreamConstraints & { video: { zoom: boolean } } = {
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
    stream = await navigator.mediaDevices.getUserMedia(searchConstrants);

    // attach it to the Video html element (will begin playing)
    if (videoRef?.current)
      videoRef.current.srcObject = stream;

    // get the video track
    [track] = stream.getVideoTracks();
  } catch (error: any) {
    throw (error.name === 'NotAllowedError') ? new Error('Camera access denied') : error;
  }

  if (!track)
    throw new Error('No video track found');

  // assume we started it
  currMediaStream = stream;

  // Get capabilities (for the zoom ranges)
  const capabilities = track.getCapabilities() as MediaTrackCapabilities & { zoom: { min: number, max: number, step: number } };
  const settings = track.getSettings();

  // Map zoom to a slider element.
  let zoomControl: React.ReactNode | null = null;
  if (capabilities.zoom) {
    const { min, max, step } = capabilities.zoom;
    zoomControl =
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mx: 1 }}>
        <Typography>Zoom:</Typography>
        <Slider
          color='neutral' size='lg'
          min={min} max={max} step={step} defaultValue={1}
          onChange={(_event, value) => track.applyConstraints({ advanced: [{ zoom: value as number }] } as any)}
          sx={{ mx: 2 }}
        />
      </Box>;
  }

  return {
    info: `Settings: ${JSON.stringify(settings, null, 2)}\n\nCapabilities: ${JSON.stringify(capabilities, null, 2)}`,
    zoomControl: zoomControl,
  };
}
