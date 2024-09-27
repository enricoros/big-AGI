/**
 * Copyright (c) 2024 Enrico Ros
 *
 * Functions to deal with HTML5Video elements.
 * Also see imageUtils.ts for more image-related functions.
 */

import { asyncCanvasToBlob, renderVideoFrameToNewCanvas } from './canvasUtils';
import { downloadBlob } from './downloadUtils';
import { prettyTimestampForFilenames } from './timeUtils';


type AllowedFormats = 'image/png' | 'image/jpeg';


/**
 * Take the current frame of a video element and downloads it as a named PNG file.
 * Video -> Canvas -> Blob -> (download)
 */
export async function downloadVideoFrame(videoElement: HTMLVideoElement, prefixName: string, imageFormat: AllowedFormats, imageQuality?: number) {
  // Video -> Canvas -> Blob
  const renderedFrame: HTMLCanvasElement = renderVideoFrameToNewCanvas(videoElement);
  const blob: Blob | null = await asyncCanvasToBlob(renderedFrame, imageFormat, imageQuality);
  if (!blob) throw new Error('Failed to render video frame to Blob.');
  // Blob -> download
  downloadBlob(blob, _videoPrettyFileName(prefixName, renderedFrame, imageFormat));
}

/**
 * Take the current frame of a video element and returns it as a File.
 */
export async function renderVideoFrameAsFile(videoElement: HTMLVideoElement, prefixName: string, imageFormat: AllowedFormats, imageQuality?: number): Promise<File> {
  // Video -> Canvas -> Blob
  const renderedFrame: HTMLCanvasElement = renderVideoFrameToNewCanvas(videoElement);
  const blob: Blob | null = await asyncCanvasToBlob(renderedFrame, imageFormat, imageQuality);
  if (!blob) throw new Error('Failed to render video frame to Blob.');
  // Blob -> File
  return new File([blob], _videoPrettyFileName(prefixName, renderedFrame, imageFormat), { type: blob.type });
}


function _videoPrettyFileName(prefixName: string, renderedFrame: HTMLCanvasElement, imageFormat: AllowedFormats): string {
  const prettyResolution = `${renderedFrame.width}x${renderedFrame.height}`;
  return `${prefixName}_${prettyTimestampForFilenames()}_${prettyResolution}.${imageFormat === 'image/png' ? 'png' : 'jpg'}`;
}
