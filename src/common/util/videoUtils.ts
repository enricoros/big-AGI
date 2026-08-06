/**
 * Copyright (c) 2024 Enrico Ros
 *
 * Functions to deal with HTML5Video elements.
 * Also see imageUtils.ts for more image-related functions.
 */

import { asyncCanvasToBlobWithValidation, renderVideoFrameToNewCanvas } from './canvasUtils';
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
  try {
    const { blob } = await asyncCanvasToBlobWithValidation(renderedFrame, imageFormat, imageQuality, 'downloadVideoFrame');
    // Blob -> download
    downloadBlob(blob, _videoPrettyFileName(prefixName, renderedFrame, imageFormat));
  } catch (error) {
    throw new Error(`Failed to download video frame: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Take the current frame of a video element and returns it as a File.
 */
export async function renderVideoFrameAsFile(videoElement: HTMLVideoElement, prefixName: string, imageFormat: AllowedFormats, imageQuality?: number): Promise<File> {
  // Video -> Canvas -> Blob
  const renderedFrame: HTMLCanvasElement = renderVideoFrameToNewCanvas(videoElement);
  try {
    const { blob, actualMimeType } = await asyncCanvasToBlobWithValidation(renderedFrame, imageFormat, imageQuality, 'renderVideoFrameAsFile');
    // Blob -> File
    return new File([blob], _videoPrettyFileName(prefixName, renderedFrame, actualMimeType), { type: actualMimeType });
  } catch (error) {
    throw new Error(`Failed to render video frame: ${error instanceof Error ? error.message : String(error)}`);
  }
}


function _videoPrettyFileName(prefixName: string, renderedFrame: HTMLCanvasElement, imageFormat: AllowedFormats | string /* allowing for the actual mime type to be different */): string {
  const prettyResolution = `${renderedFrame.width}x${renderedFrame.height}`;
  const extensions: { [mime: string]: string } = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  const extension = extensions[imageFormat] || 'jpg'; // Fallback to jpg if format is not recognized
  return `${prefixName}_${prettyTimestampForFilenames()}_${prettyResolution}.${extension}`;
}
