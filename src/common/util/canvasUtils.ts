/**
 * Creates a Blob object representing the image contained in the canvas
 * @param canvas The canvas element to convert to a Blob.
 * @param imageFormat Browsers are required to support image/png; many will support additional formats including image/jpeg and image/webp.
 */
export async function canvasToImageBlob(canvas: HTMLCanvasElement, imageFormat: 'image/png' /* was ": string = 'image/png'", but we are more strict for now */): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, imageFormat));
}