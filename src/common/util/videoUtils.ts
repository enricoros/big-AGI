/**
 * Copyright (c) 2024 Enrico Ros
 *
 * Functions to deal with HTML5Video elements.
 */

import { prettyTimestampForFilenames } from './timeUtils';

export function downloadVideoFrameAsPNG(videoElement: HTMLVideoElement, prefixName: string) {
  // current video frame -> canvas -> dataURL PNG
  const renderedFrame = _renderVideoFrameToCanvas(videoElement);
  const imageDataURL = renderedFrame.toDataURL('image/png');

  // auto-download
  const link = document.createElement('a');
  link.download = _prettyFileName(prefixName, renderedFrame);
  link.href = imageDataURL;
  document.body.appendChild(link); // Ensure visibility in the DOM for Firefox
  link.click();
  document.body.removeChild(link); // Clean up
}

export async function renderVideoFrameAsPNGFile(videoElement: HTMLVideoElement, prefixName: string): Promise<File> {
  // current video frame -> canvas -> Blob PNG
  const renderedFrame = _renderVideoFrameToCanvas(videoElement);
  const blob = await _canvasToBlob(renderedFrame, 'image/png');

  // to File
  if (!blob)
    throw new Error('Failed to convert canvas to Blob');
  return new File([blob], _prettyFileName(prefixName, renderedFrame), { type: blob.type });
}

function _prettyFileName(prefixName: string, renderedFrame: HTMLCanvasElement) {
  const prettyResolution = `${renderedFrame.width}x${renderedFrame.height}`;
  return `${prefixName}_${prettyTimestampForFilenames()}_${prettyResolution}.png`;
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

/**
 * Creates a Blob object representing the image contained in the canvas
 * @param canvas The canvas element to convert to a Blob.
 * @param imageFormat Browsers are required to support image/png; many will support additional formats including image/jpeg and image/webp.
 */
async function _canvasToBlob(canvas: HTMLCanvasElement, imageFormat: string = 'image/png'): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, imageFormat));
}