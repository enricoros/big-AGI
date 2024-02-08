import { isBrowser } from './pwaUtils';
import { renderVideoFrameAsPNGFile } from '~/common/util/videoUtils';


// Check if the browser supports screen capture
export const supportsScreenCapture = isBrowser && !!navigator.mediaDevices?.getDisplayMedia;


export async function takeScreenCapture(): Promise<File | null> {
  if (!supportsScreenCapture) return null;

  // open a media stream to capture the screen, which shows the user a dialog to select the screen to capture
  let mediaStream: MediaStream;
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (error: any) {
    // User did not grant permission to capture screen
    if (error.name === 'NotAllowedError')
      return null;
    // else, rethrow
    throw error;
  }

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
  await new Promise((resolve) => setTimeout(resolve, 100));

  // capture a frame (or throw)
  try {
    const file = await renderVideoFrameAsPNGFile(video, 'capture');
    _stopScreenCaptureStream(mediaStream, video);
    return file;
  } catch (error) {
    _stopScreenCaptureStream(mediaStream, video);
    throw error;
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