/**
 * Creates a Blob object representing the image contained in the canvas
 * @param canvas The canvas element to convert to a Blob.
 * @param imageFormat Browsers are required to support image/png; many will support additional formats including image/jpeg and image/webp.
 * @param imageQuality A Number between 0 and 1 indicating image quality if the requested type is image/jpeg or image/webp.
 */
export async function asyncCanvasToBlob(canvas: HTMLCanvasElement, imageFormat: 'image/png' | 'image/jpeg', imageQuality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, imageFormat, imageQuality));
}

export function renderVideoFrameToNewCanvas(videoElement: HTMLVideoElement): HTMLCanvasElement {
  // paint the video on a canvas, to save it
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(videoElement, 0, 0);
  return canvas;
}
