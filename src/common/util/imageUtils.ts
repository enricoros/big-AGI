/**
 * Copyright (c) 2024 Enrico Ros
 *
 * Functions to deal with images from the frontend.
 * Also see videoUtils.ts for more image-related functions.
 */


/**
 * Asynchronously gets the dimensions of a base64DataURL image.
 */
export async function getImageDimensions(base64DataUrl: string): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      resolve({
        width: image.width,
        height: image.height,
      });
    };
    image.onerror = (error) => {
      reject(new Error('Failed to load image for dimension extraction.'));
    };
    image.src = base64DataUrl;
  });
}


/**
 * Converts an image buffer to WebP format and returns the base64 encoded string.
 */
export async function convertBase64Image(base64DataUrl: string, destMimeType = 'image/webp'): Promise<{
  mimeType: string,
  base64: string,
}> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(image, 0, 0);
      const dataUrl = canvas.toDataURL(destMimeType);
      resolve({
        mimeType: destMimeType,
        base64: dataUrl.split(',')[1],
      });
    };
    image.onerror = (error) => {
      reject(new Error('Failed to load image for conversion.'));
    };
    image.src = base64DataUrl;
  });
}