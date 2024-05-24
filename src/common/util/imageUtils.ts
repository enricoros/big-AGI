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
export async function convertBase64Image(base64DataUrl: string, destMimeType: string /*= 'image/webp'*/, destQuality: number /*= 0.90*/): Promise<{
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
      const dataUrl = canvas.toDataURL(destMimeType, destQuality);
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


/**
 * Resizes an image to have its largest side equal to the given max size while maintaining the aspect ratio.
 */
export async function resizeBase64Image(base64DataUrl: string, resizeMode: 'openai', destMimeType: string /*= 'image/webp'*/, destQuality: number /*= 0.90*/): Promise<{
  mimeType: string,
  base64: string,
}> {
  const maxSide = 1024;
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      const aspectRatio = image.width / image.height;
      let newWidth, newHeight;

      if (image.width > image.height) {
        newWidth = maxSide;
        newHeight = maxSide / aspectRatio;
      } else {
        newHeight = maxSide;
        newWidth = maxSide * aspectRatio;
      }

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(image, 0, 0, newWidth, newHeight);
      const resizedDataUrl = canvas.toDataURL(destMimeType, destQuality);
      resolve({
        mimeType: destMimeType,
        base64: resizedDataUrl.split(',')[1], // Return base64 part only
      });
    };
    image.onerror = (error) => {
      reject(new Error('Failed to load image for resizing.'));
    };
    image.src = base64DataUrl;
  });
}