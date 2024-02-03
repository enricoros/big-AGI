/**
 * Copyright (c) 2024 Enrico Ros
 *
 * Functions to deal with HTML5Video elements.
 */

export function downloadVideoFrameAsPNG(videoElement: HTMLVideoElement, prefixName: string) {
  // video to canvas to png
  const renderedFrame = _renderVideoFrameToCanvas(videoElement);
  const imageDataURL = renderedFrame.toDataURL('image/png');

  // auto-download
  const link = document.createElement('a');
  link.download = _prettyFileName(prefixName, renderedFrame);
  link.href = imageDataURL;
  link.click();
}

export function renderVideoFrameToFile(videoElement: HTMLVideoElement, prefixName: string, callback: (file: File) => void) {
  // video to canvas
  const renderedFrame = _renderVideoFrameToCanvas(videoElement);

  // canvas to blob to file to callback
  renderedFrame.toBlob((blob) => {
    if (blob) {
      const file = new File([blob], _prettyFileName(prefixName, renderedFrame), { type: blob.type });
      callback(file);
    }
  }, 'image/png');
}

function _prettyFileName(prefixName: string, renderedFrame: HTMLCanvasElement) {
  const prettyDate = new Date().toISOString().replace(/[:-]/g, '').replace('T', '-').replace('Z', '');
  const prettyResolution = `${renderedFrame.width}x${renderedFrame.height}`;
  return `${prefixName}-${prettyDate}-${prettyResolution}.png`;
}

function _renderVideoFrameToCanvas(videoElement: HTMLVideoElement): HTMLCanvasElement {
  // paint the video on a canvas, to save it
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(videoElement, 0, 0);
  return canvas;
}

