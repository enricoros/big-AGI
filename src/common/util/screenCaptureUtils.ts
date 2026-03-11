import { Is, isBrowser } from './pwaUtils';
import { renderVideoFrameAsFile } from '~/common/util/videoUtils';


// cache if the browser supports screen capture
export const supportsScreenCapture = isBrowser && !!navigator.mediaDevices?.getDisplayMedia;


export interface ScreenCaptureStream {
  stream: MediaStream;
  label: string;    // e.g. "Screen 1", window title, tab name
  width?: number;
  height?: number;
  frameRate?: number;
}


/**
 * Opens a screen capture stream (shows the browser's screen picker).
 * Returns stream + track metadata, or null if the user canceled.
 */
export async function startScreenCaptureStream(): Promise<ScreenCaptureStream | null> {
  if (!supportsScreenCapture) return null;

  // detect a browser issue
  const startTime = Date.now();

  // open a media stream to capture the screen, which shows the user a dialog to select the screen to capture
  let mediaStream: MediaStream;
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (error: any) {
    // User did not grant permission to capture screen
    if (error.name === 'NotAllowedError') {

      // Safari on macOS has a known issue where canceling the window selection causes a 60-second delay
      // before throwing the permission error. We detect this case and provide a user-friendly message.
      if (Is.Browser.Safari && Is.OS.MacOS && (Date.now() - startTime) > 50000)
        throw new Error('Safari took about a minute to detect that the user canceled window selection. It is faster to select any window and then delete the attachment rather than canceling.');

      return null;
    }
    // else, rethrow
    throw error;
  }

  // extract track metadata
  const videoTrack = mediaStream.getVideoTracks()?.[0];
  const settings = videoTrack?.getSettings();
  return {
    stream: mediaStream,
    label: videoTrack?.label || 'Screen',
    ...(settings?.width && settings?.height ? { width: settings.width, height: settings.height } : {}),
    ...(settings?.frameRate ? { frameRate: settings.frameRate } : {}),
  };
}


export async function takeScreenCapture(): Promise<File | null> {
  const capture = await startScreenCaptureStream();
  if (!capture) return null;
  const mediaStream = capture.stream;

  // connect a video element to the media stream, to capture a frame
  const video: HTMLVideoElement = document.createElement('video');
  video.srcObject = mediaStream;

  // wait for the video to load
  const metadataLoaded = new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(null);
  });
  await video.play();
  await metadataLoaded;

  // short timeout to ensure the video frame is ready
  await new Promise((resolve) => setTimeout(resolve, 200));

  // capture a frame (cleanup always runs)
  try {
    return await renderVideoFrameAsFile(video, 'capture', 'image/png');
  } finally {
    _stopScreenCaptureStream(mediaStream, video);
  }
}

function _stopScreenCaptureStream(mediaStream: MediaStream, videoElement: HTMLVideoElement) {
  try {
    mediaStream.getTracks().forEach(track => track.stop());
  } catch (error) {
    // ...
  }

  // [stop] close the video element
  try {
    videoElement.pause();
    videoElement.srcObject = null;
    videoElement.onloadedmetadata = null;
    videoElement.remove();
  } catch (error) {
    // ...
  }
}