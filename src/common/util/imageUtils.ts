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
 * Resizes an image based on the specified resize mode.
 */
export async function resizeBase64Image(base64DataUrl: string, resizeMode: 'openai' | 'google' | 'anthropic', destMimeType: string /*= 'image/webp'*/, destQuality: number /*= 0.90*/): Promise<{
  mimeType: string,
  base64: string,
}> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      let newWidth: number;
      let newHeight: number;

      switch (resizeMode) {
        case 'openai':
          // Resize to fit within 2048x2048, then scale shortest side to 768px
          const maxSideOpenAI = 2048;
          const minSideOpenAI = 768;
          if (image.width > maxSideOpenAI || image.height > maxSideOpenAI) {
            if (image.width > image.height) {
              newWidth = maxSideOpenAI;
              newHeight = (image.height / image.width) * maxSideOpenAI;
              if (newHeight < minSideOpenAI) {
                newHeight = minSideOpenAI;
                newWidth = (image.width / image.height) * minSideOpenAI;
              }
            } else {
              newHeight = maxSideOpenAI;
              newWidth = (image.width / image.height) * maxSideOpenAI;
              if (newWidth < minSideOpenAI) {
                newWidth = minSideOpenAI;
                newHeight = (image.height / image.width) * minSideOpenAI;
              }
            }
          } else {
            newWidth = image.width;
            newHeight = image.height;
          }
          break;

        case 'google':
          // Resize to fit within 3072x3072
          const maxSideGoogle = 3072;
          if (image.width > maxSideGoogle || image.height > maxSideGoogle) {
            if (image.width > image.height) {
              newWidth = maxSideGoogle;
              newHeight = (image.height / image.width) * maxSideGoogle;
            } else {
              newHeight = maxSideGoogle;
              newWidth = (image.width / image.height) * maxSideGoogle;
            }
          } else {
            newWidth = image.width;
            newHeight = image.height;
          }
          break;

        case 'anthropic':
          // Resize to fit within 1568px on the long edge
          const maxSideAnthropic = 1568;
          if (image.width > maxSideAnthropic || image.height > maxSideAnthropic) {
            if (image.width > image.height) {
              newWidth = maxSideAnthropic;
              newHeight = (image.height / image.width) * maxSideAnthropic;
            } else {
              newHeight = maxSideAnthropic;
              newWidth = (image.width / image.height) * maxSideAnthropic;
            }
          } else {
            newWidth = image.width;
            newHeight = image.height;
          }
          break;

        default:
          reject(new Error('Unsupported resize mode'));
          return;
      }

      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(image, 0, 0, newWidth, newHeight);
      const resizedDataUrl = canvas.toDataURL(destMimeType, destQuality);
      resolve({
        mimeType: destMimeType,
        base64: resizedDataUrl.split(',')[1], // Return base64 part only
      });
    };
    image.onerror = (error) => {
      console.log('Failed to load image for resizing.', error);
      reject(new Error('Failed to load image for resizing.'));
    };
    image.src = base64DataUrl;
  });
}