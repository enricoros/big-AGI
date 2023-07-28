import * as React from 'react';

import { Box, Slider } from '@mui/joy';

/**
 * `useCamera` is our React hook for interacting with a camera device.
 *
 * It accepts a MediaDeviceInfo object representing the selected device,
 * and returns an object containing states and methods for controlling the camera.
 *
 * Be sure to set the video ref to the video element in your component.
 */
export function useCamera(selectedDevice: MediaDeviceInfo | null) {
  // state
  const [error, setError] = React.useState<string | null>(null);
  const [infoText, setInfoText] = React.useState<string | null>(null);
  const [zoomControl, setZoomControl] = React.useState<React.ReactNode>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

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
              onChange={(_event, value) => track.applyConstraints({ advanced: [{ zoom: value as number }] } as any)}
            /></Box>;
            setZoomControl(control);
          }
        }

      } catch (error: any) {
        setError(error?.message || error?.toString() || 'Error accessing camera');
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

  return { videoRef, infoText, zoomControl, startCamera, stopCamera, error };
}