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
      console.warn('Failed to load image for dimension extraction.', error);
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
      console.warn('Failed to load image for conversion.', error);
      reject(new Error('Failed to load image for conversion.'));
    };
    image.src = base64DataUrl;
  });
}


export type LLMImageResizeMode = 'openai-low-res' | 'openai-high-res' | 'google' | 'anthropic';

/**
 * Resizes an image based on the specified resize mode.
 */
export async function resizeBase64Image(base64DataUrl: string, resizeMode: LLMImageResizeMode, destMimeType: string /*= 'image/webp'*/, destQuality: number /*= 0.90*/): Promise<{
  mimeType: string,
  base64: string,
}> {
  const image = new Image();
  image.crossOrigin = 'Anonymous';

  return new Promise((resolve, reject) => {
    image.onload = () => {
      const originalWidth = image.width;
      const originalHeight = image.height;

      let newWidth: number = 0;
      let newHeight: number = 0;
      let shouldResize = false;

      switch (resizeMode) {
        case 'anthropic':
          // Resize to fit within 1568px on the long edge
          const maxSideAnthropic = 1568;
          if (originalWidth > maxSideAnthropic || originalHeight > maxSideAnthropic) {
            shouldResize = true;
            if (originalWidth > originalHeight) {
              newWidth = maxSideAnthropic;
              newHeight = (originalHeight / originalWidth) * maxSideAnthropic;
            } else {
              newHeight = maxSideAnthropic;
              newWidth = (originalWidth / originalHeight) * maxSideAnthropic;
            }
          }
          break;

        case 'google':
          // Resize to fit within 3072x3072
          const maxSideGoogle = 3072;
          if (originalWidth > maxSideGoogle || originalHeight > maxSideGoogle) {
            shouldResize = true;
            if (originalWidth > originalHeight) {
              newWidth = maxSideGoogle;
              newHeight = (originalHeight / originalWidth) * maxSideGoogle;
            } else {
              newHeight = maxSideGoogle;
              newWidth = (originalWidth / originalHeight) * maxSideGoogle;
            }
          }
          break;

        case 'openai-high-res':
          // Resize to fit within 2048x2048, then scale shortest side to 768px without upscaling
          const maxSideOpenAI = 2048;
          const minSideOpenAI = 768;
          if (originalWidth > maxSideOpenAI || originalHeight > maxSideOpenAI) {
            shouldResize = true;
            if (originalWidth > originalHeight) {
              newWidth = maxSideOpenAI;
              newHeight = (originalHeight / originalWidth) * maxSideOpenAI;
              if (newHeight < minSideOpenAI) {
                newHeight = minSideOpenAI;
                newWidth = (originalWidth / originalHeight) * minSideOpenAI;
              }
            } else {
              newHeight = maxSideOpenAI;
              newWidth = (originalWidth / originalHeight) * maxSideOpenAI;
              if (newWidth < minSideOpenAI) {
                newWidth = minSideOpenAI;
                newHeight = (originalHeight / originalWidth) * minSideOpenAI;
              }
            }
          } else if (originalWidth < minSideOpenAI || originalHeight < minSideOpenAI) {
            shouldResize = true;
            if (originalWidth > originalHeight) {
              newWidth = minSideOpenAI;
              newHeight = (originalHeight / originalWidth) * minSideOpenAI;
            } else {
              newHeight = minSideOpenAI;
              newWidth = (originalWidth / originalHeight) * minSideOpenAI;
            }
          }
          break;

        case 'openai-low-res':
          // Resize to 512x512 without upscaling
          if (originalWidth > 512 || originalHeight > 512) {
            shouldResize = true;
            newWidth = 512;
            newHeight = 512;
          }
          break;

        default:
          reject(new Error('Unsupported resize mode'));
          return;
      }

      if (!shouldResize || !newWidth || !newHeight) {
        // No resizing needed, return original data
        resolve({
          mimeType: destMimeType,
          base64: base64DataUrl.split(',')[1], // Return base64 part only
        });
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
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
      console.warn('Failed to load image for resizing.', error);
      reject(new Error('Failed to load image for resizing.'));
    };

    // this starts the decoding
    image.src = base64DataUrl;
  });
}