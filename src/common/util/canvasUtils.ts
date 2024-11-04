/**
 * Converts a canvas to a data URL and extracts the MIME type and Base64 data
 * @param canvas The canvas element to convert
 * @param requestedMimeType The desired MIME type for the image
 * @param imageQuality A number between 0 and 1 indicating image quality for lossy formats
 * @param userLogLabel A label to use in console warnings
 */
export function canvasToDataURLAndMimeType(
  canvas: HTMLCanvasElement,
  requestedMimeType: string,
  imageQuality: number | undefined,
  userLogLabel: string,
): { mimeType: string; base64Data: string } {

  // Extract the actual MIME type and Base64 data efficiently
  const dataUrl = canvas.toDataURL(requestedMimeType, imageQuality);

  const colonIndex = dataUrl.indexOf(':');
  const semicolonIndex = dataUrl.indexOf(';', colonIndex);
  if (colonIndex === -1 || semicolonIndex === -1)
    throw new Error('canvasToDataURLAndMimeType: Invalid data URL format.');
  const actualMimeType = dataUrl.slice(colonIndex + 1, semicolonIndex);

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1)
    throw new Error('canvasToDataURLAndMimeType: Invalid data URL comma.');
  const base64Data = dataUrl.slice(commaIndex + 1);

  // Warn if the actual MIME type differs from the requested one
  if (actualMimeType !== requestedMimeType)
    console.warn(`${userLogLabel}: requested MIME type "${requestedMimeType}" was not used. Actual MIME type is "${actualMimeType}".`);

  return { mimeType: actualMimeType, base64Data };
}

/**
 * Creates a Blob object representing the image contained in the canvas
 * @param canvas The canvas element to convert to a Blob.
 * @param imageFormat Browsers are required to support image/png; many will support additional formats including image/jpeg and image/webp.
 * @param imageQuality A Number between 0 and 1 indicating image quality if the requested type is image/jpeg or image/webp.
 */
export async function asyncCanvasToBlob(
  canvas: HTMLCanvasElement,
  imageFormat: 'image/png' | 'image/jpeg',
  imageQuality?: number
): Promise<Blob | null> {
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
