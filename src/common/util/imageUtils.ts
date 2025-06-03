/**
 * Copyright (c) 2024-2025 Enrico Ros
 *
 * Functions to deal with images from the frontend.
 * Also see videoUtils.ts for more image-related functions.
 */

import { DEFAULT_ADRAFT_IMAGE_MIMETYPE, DEFAULT_ADRAFT_IMAGE_QUALITY } from '../attachment-drafts/attachment.pipeline';

import { asyncCanvasToBlobWithValidation } from './canvasUtils';
import { convert_Base64DataURL_To_Base64WithMimeType, convert_Base64WithMimeType_To_Blob, convert_Blob_To_Base64 } from './blobUtils';

// configuration
const IMAGE_DIMENSIONS = {
  ANTHROPIC_MAX_SIDE: 1568,
  GOOGLE_MAX_SIDE: 3072,
  OPENAI_HIGH_RES_MAX_SIDE: 2048,
  OPENAI_HIGH_RES_MIN_SIDE: 768,
  OPENAI_LOW_RES_SIDE: 512,
  THUMBNAIL_128: 128,
  THUMBNAIL_256: 256,
} as const;


export type CommonImageMimeTypes = 'image/png' | 'image/jpeg' | 'image/webp';
export type LLMImageResizeMode = 'openai-low-res' | 'openai-high-res' | 'google' | 'anthropic' | 'thumbnail-128' | 'thumbnail-256';


/**
 * Opens an image Data URL in a new tab
 */
export async function showImageDataURLInNewTab(imageDataURL: string) {
  try {
    const { base64Data, mimeType } = convert_Base64DataURL_To_Base64WithMimeType(imageDataURL, 'showImageDataURLInNewTab');
    const imageBlob = await convert_Base64WithMimeType_To_Blob(base64Data, mimeType, 'showImageDataURLInNewTab');
    const blobURL = URL.createObjectURL(imageBlob);

    if (showBlobObjectURLInNewTab(blobURL)) {
      return blobURL;
    } else {
      URL.revokeObjectURL(blobURL);
      return null;
    }
  } catch (error) {
    console.warn('showImageDataURLInNewTab: Failed to convert image Data URL to Blob URL.', error);
    return null;
  }
}

/**
 * Opens a blob URL in a new tab
 * @returns true if window.open succeeded, false otherwise
 */
export function showBlobObjectURLInNewTab(blobURL: string): boolean {
  if (typeof window !== 'undefined') {
    try {
      return window.open(blobURL, '_blank', 'noopener,noreferrer') !== null;
    } catch (error) {
      console.warn('showBlobURLInNewTab: Failed to open new tab.', error);
      return false;
    }
  }
  return false;
}


/**
 * Converts an SVG string to a PNG Blob via an intermediate canvas.
 */
export async function renderSVGToPNGBlob(svgCode: string, transparentBackground: boolean, renderScale: number = 2.0): Promise<Blob | null> {
  if (!svgCode) return null;

  // Create a Blob URL for the SVG
  const svgBlob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  // Load the SVG image
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => {
      console.error('Error loading SVG image:', e);
      reject(e);
    };
  });

  // Prepare canvas @[Scale]x, e.g. @2x
  const canvasWidth = img.width * renderScale;
  const canvasHeight = img.height * renderScale;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(url);
    return null;
  }

  // Handle background
  if (!transparentBackground) {
    // TODO: make it responsive, such as with:
    // document.querySelector('html')?.getAttribute('data-joy-color-scheme') === 'dark'
    // ctx.fillStyle = '#FFFFFF';
    // ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else {
    // clear the canvas to ensure transparency
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  }

  // Draw the SVG image @2x
  ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);

  // Convert canvas to PNG Blob, and we're done
  try {
    const { blob } = await asyncCanvasToBlobWithValidation(canvas, 'image/png', undefined, 'renderSVGToPNGBlob');
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}


// ===== BASE64-BASED IMAGE UTILITIES (Legacy - thin wrappers) =====

/**
 * @returns null if the image does not need resizing
 * @throws error if the resize mode is unsupported or if resizing fails or if any conversion fails.
 * @deprecated Use imageBlobResizeIfNeeded for better performance and memory efficiency
 */
export async function resizeBase64ImageIfNeeded(inputMimeType: string, inputBase64Data: string, resizeMode: LLMImageResizeMode, destMimeType: CommonImageMimeTypes /*= 'image/webp'*/, destQuality: number /*= 0.90*/): Promise<{
  base64: string,
  mimeType: string,
} | null> {

  const inputBlob = await convert_Base64WithMimeType_To_Blob(inputBase64Data, inputMimeType, 'resizeBase64ImageIfNeeded');

  const resizedBlob = await imageBlobResizeIfNeeded(inputBlob, resizeMode, destMimeType, destQuality);
  if (!resizedBlob) return null;

  const base64Data = await convert_Blob_To_Base64(resizedBlob.blob, 'resizeBase64ImageIfNeeded');
  return {
    base64: base64Data,
    mimeType: resizedBlob.blob.type,
  };
}


// ===== BLOB-BASED IMAGE UTILITIES =====

interface ImageTransformOptions {
  /** Resize mode for the image, if specified. */
  resizeMode?: LLMImageResizeMode,
  /** If unspecified, we'll use the DEFAULT_ADRAFT_IMAGE_MIMETYPE (webp for chrome/firefox, jpeg for safari which doesn't encode webp) */
  convertToMimeType?: 'image/png' | 'image/jpeg' | 'image/webp',
  /** If specified, we'll use the DEFAULT_ADRAFT_IMAGE_QUALITY */
  convertToLossyQuality?: number, // 0-1, only used if convertToMimeType is lossy (jpeg or webp)
  /** If true, resize errors (image decode, canvas drawImage) will throw (default: false) Note that if the image does not need to be resized, this will not throw. */
  throwOnResizeError?: boolean,
  /** If true, type conversion errors (image type conversion) will throw (default: false) */
  throwOnTypeConversionError?: boolean,
}

interface ImageTransformOperationResult extends ImageOperationResult {
  hasResized: boolean;
  hasTypeConverted: boolean;
  initialSize: number;
  initialType: string;
  finalSize: number;
  sizeRatio: number; // percentage difference in size compared to the initial size
}

interface ImageOperationResult {
  blob: Blob;
  // if either width or height is 0, the dimension could not be determined
  width: 0 | number;
  height: 0 | number;
}


/**
 * Transform/resize/convert an image Blob based on the provided options.
 * By default this function does not throw on errors, at worst returning the same input Blob without dimension information.
 * @throws error if resizing or type conversion fails and the respective options are set to throwOnResizeError or throwOnTypeConversionError.
 */
export async function imageBlobTransform(inputImage: Blob, options: ImageTransformOptions): Promise<ImageTransformOperationResult> {

  // remember the initial state, for stats
  const initialSize: number = inputImage.size;
  const initialType: string = inputImage.type;

  // working state - for pipeline-like processing
  let workingBlob: Blob = inputImage;
  let workingWidth: number = 0;
  let workingHeight: number = 0;


  // 1. Resize & Format-convert image if requested
  let hasResized = false;
  let hasTypeConverted = false;
  if (options.resizeMode) {

    // if null, resizing was not needed or possible (size could not be a fit)
    // this will throw an error if the resizeMode is not supported
    try {
      const resized = await imageBlobResizeIfNeeded(
        workingBlob,
        options.resizeMode,
        options.convertToMimeType ?? DEFAULT_ADRAFT_IMAGE_MIMETYPE,
        options.convertToLossyQuality ?? DEFAULT_ADRAFT_IMAGE_QUALITY,
      );
      if (resized) {
        hasResized = true;
        hasTypeConverted = (resized.blob.type !== workingBlob.type);
        workingBlob = resized.blob;
        workingWidth = resized.width;
        workingHeight = resized.height;
      }
    } catch (resizeError) {
      console.warn('[DEV] transformImageBlob: Error resizing image:', { resizeError });
      if (options.throwOnResizeError)
        throw new Error(`Failed to resize image: ${resizeError instanceof Error ? resizeError.message : String(resizeError)}`);
    }
  }

  // 2. Convert to a target mimetype if requested
  if (options.convertToMimeType && workingBlob.type !== options.convertToMimeType) {
    try {
      const converted = await imageBlobConvertType(
        workingBlob,
        options.convertToMimeType,
        options.convertToLossyQuality ?? DEFAULT_ADRAFT_IMAGE_QUALITY,
      );
      hasTypeConverted = true;
      workingBlob = converted.blob;
      workingWidth = converted.width || workingWidth;
      workingHeight = converted.height || workingHeight;
    } catch (typeConversionError) {
      console.warn('[DEV] transformImageBlob: Error converting image type:', { typeConversionError });
      if (options.throwOnTypeConversionError)
        throw new Error(`Failed to convert image type: ${typeConversionError instanceof Error ? typeConversionError.message : String(typeConversionError)}`);
    }
  }

  // 3. Find out the image dimensions if not available (frontend)
  if (!workingWidth || !workingHeight) {
    try {
      const dimensions = await imageBlobGetDimensions(workingBlob);
      workingWidth = dimensions.width || 0;
      workingHeight = dimensions.height || 0;
    } catch (dimError) {
      // sizing failed, but this is not fatal
      console.log('[DEV] Failed to get image dimensions from Blob:', { dimError });
    }
  }

  // return the result
  const finalSize = workingBlob.size;
  return {
    blob: workingBlob,
    width: workingWidth,
    height: workingHeight,
    hasResized: hasResized,
    hasTypeConverted: hasTypeConverted,
    initialType: initialType,
    initialSize: initialSize,
    finalSize: finalSize,
    sizeRatio: (initialSize && finalSize) ? Math.round(((finalSize - initialSize) / initialSize) * 100) : 1,
  };
}


/**
 * Asynchronously gets the dimensions of a Blob image.
 */
export async function imageBlobGetDimensions(imageBlob: Blob): Promise<{ width: number, height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      URL.revokeObjectURL(image.src);
      resolve({ width: image.width, height: image.height });
    };
    image.onerror = (error: string | Event) => {
      URL.revokeObjectURL(image.src);
      console.warn('Failed to load image blob for dimension extraction.', { error });
      reject(new Error('Failed to load image blob for dimension extraction.'));
    };
    image.src = URL.createObjectURL(imageBlob);
  });
}


/**
 * Converts an image Blob to a different format and returns the new Blob with dimensions.
 * @throws error if the conversion fails.
 */
export async function imageBlobConvertType(imageBlob: Blob, toMimeType: CommonImageMimeTypes, toLossyQuality: number): Promise<ImageOperationResult> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'Anonymous';
    image.onload = () => {
      URL.revokeObjectURL(image.src);

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx)
        return reject(new Error('Failed to get canvas context for conversion'));
      ctx.drawImage(image, 0, 0);

      // Convert canvas to Blob with validation
      asyncCanvasToBlobWithValidation(canvas, toMimeType, toLossyQuality, 'imageBlobConvertType')
        .then(({ blob }) => resolve({ blob, width: image.width, height: image.height }))
        .catch((reason) => reject(new Error(`Failed to convert image blob to '${toMimeType}': ${reason instanceof Error ? reason.message : String(reason)}`)));
    };
    image.onerror = (error: string | Event) => {
      URL.revokeObjectURL(image.src);
      console.warn('Failed to load image blob for conversion.', { error });
      reject(new Error('Failed to load image blob for type conversion.'));
    };
    image.src = URL.createObjectURL(imageBlob);
  });
}


/**
 * Resizes an image Blob if needed based on the specified resize mode.
 * Does not throw if resize if not needed, only returns null (and does not adapt the mime).
 * @throws error if the resize mode is unsupported or if resizing fails.
 */
export async function imageBlobResizeIfNeeded(imageBlob: Blob, resizeMode: LLMImageResizeMode, toMimeType: CommonImageMimeTypes, toLossyQuality: number): Promise<null | ImageOperationResult> {
  const image = new Image();
  image.crossOrigin = 'Anonymous';

  return new Promise((resolve, reject) => {
    image.onload = () => {
      URL.revokeObjectURL(image.src);

      const originalWidth = image.width;
      const originalHeight = image.height;

      let newWidth: number = originalWidth;
      let newHeight: number = originalHeight;
      let shouldResize = false;

      switch (resizeMode) {
        case 'anthropic':
          // Resize to fit within 1568px on the long edge
          const maxSideAnthropic = IMAGE_DIMENSIONS.ANTHROPIC_MAX_SIDE;
          if (originalWidth > maxSideAnthropic || originalHeight > maxSideAnthropic) {
            shouldResize = true;
            if (originalWidth > originalHeight) {
              newWidth = maxSideAnthropic;
              newHeight = Math.round((originalHeight / originalWidth) * maxSideAnthropic);
            } else {
              newHeight = maxSideAnthropic;
              newWidth = Math.round((originalWidth / originalHeight) * maxSideAnthropic);
            }
          }
          break;

        case 'google':
          // Google: Resize to fit within 3072x3072
          const maxSideGoogle = IMAGE_DIMENSIONS.GOOGLE_MAX_SIDE;
          if (originalWidth > maxSideGoogle || originalHeight > maxSideGoogle) {
            shouldResize = true;
            if (originalWidth > originalHeight) {
              newWidth = maxSideGoogle;
              newHeight = Math.round((originalHeight / originalWidth) * maxSideGoogle);
            } else {
              newHeight = maxSideGoogle;
              newWidth = Math.round((originalWidth / originalHeight) * maxSideGoogle);
            }
          }
          break;

        case 'openai-high-res':
          // OpenAI:
          // 1. Scale down to fit within 2048x2048
          const maxSideOpenAI = IMAGE_DIMENSIONS.OPENAI_HIGH_RES_MAX_SIDE;
          if (originalWidth > maxSideOpenAI || originalHeight > maxSideOpenAI) {
            shouldResize = true;
            if (originalWidth > originalHeight) {
              newWidth = maxSideOpenAI;
              newHeight = Math.round((originalHeight / originalWidth) * maxSideOpenAI);
            } else {
              newHeight = maxSideOpenAI;
              newWidth = Math.round((originalWidth / originalHeight) * maxSideOpenAI);
            }
          }

          // 2. Scale down to 768px on the shortest side (if larger) - maintain aspect ratio
          const minSideOpenAI = IMAGE_DIMENSIONS.OPENAI_HIGH_RES_MIN_SIDE;
          if (newWidth > newHeight && newHeight > minSideOpenAI) {
            shouldResize = true;
            newWidth = Math.round((newWidth / newHeight) * minSideOpenAI);
            newHeight = minSideOpenAI;
          } else if (newWidth < newHeight && newWidth > minSideOpenAI) {
            shouldResize = true;
            newHeight = Math.round((newHeight / newWidth) * minSideOpenAI);
            newWidth = minSideOpenAI;
          }
          break;

        case 'openai-low-res':
          // Resize to 512x512 if any side is larger
          if (originalWidth <= IMAGE_DIMENSIONS.OPENAI_LOW_RES_SIDE && originalHeight <= IMAGE_DIMENSIONS.OPENAI_LOW_RES_SIDE) {
            resolve(null);
            return;
          }

          const lrScaleMode = 'keep-aspect-ratio' as ('stretch' | 'keep-aspect-ratio');
          switch (lrScaleMode) {
            case 'stretch':
              newWidth = IMAGE_DIMENSIONS.OPENAI_LOW_RES_SIDE;
              newHeight = IMAGE_DIMENSIONS.OPENAI_LOW_RES_SIDE;
              shouldResize = true;
              break;

            case 'keep-aspect-ratio':
              if (originalWidth > originalHeight) {
                newWidth = IMAGE_DIMENSIONS.OPENAI_LOW_RES_SIDE;
                newHeight = Math.round((originalHeight / originalWidth) * IMAGE_DIMENSIONS.OPENAI_LOW_RES_SIDE);
              } else {
                newHeight = IMAGE_DIMENSIONS.OPENAI_LOW_RES_SIDE;
                newWidth = Math.round((originalWidth / originalHeight) * IMAGE_DIMENSIONS.OPENAI_LOW_RES_SIDE);
              }
              shouldResize = true;
              break;
          }
          break;

        case 'thumbnail-128':
        case 'thumbnail-256':
          shouldResize = true;
          const maxSideThumbnail = resizeMode === 'thumbnail-128' ? IMAGE_DIMENSIONS.THUMBNAIL_128 : IMAGE_DIMENSIONS.THUMBNAIL_256;
          if (originalWidth > maxSideThumbnail || originalHeight > maxSideThumbnail) {
            if (originalWidth > originalHeight) {
              newWidth = maxSideThumbnail;
              newHeight = Math.round((originalHeight / originalWidth) * maxSideThumbnail);
            } else {
              newHeight = maxSideThumbnail;
              newWidth = Math.round((originalWidth / originalHeight) * maxSideThumbnail);
            }
          }
          break;

        default:
          reject(new Error('Unsupported resize mode'));
          return;
      }

      if (!shouldResize) {
        resolve(null);
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx)
        return reject(new Error('Failed to get canvas context for resizing'));

      canvas.width = newWidth;
      canvas.height = newHeight;
      ctx.drawImage(image, 0, 0, newWidth, newHeight);

      // Convert canvas to Blob with validation
      asyncCanvasToBlobWithValidation(canvas, toMimeType, toLossyQuality, 'imageBlobResizeIfNeeded')
        .then(({ blob }) => resolve({ blob, width: newWidth, height: newHeight }))
        .catch((reason) => reject(new Error(`Failed to resize image to '${resizeMode}' as '${toMimeType}': ${reason instanceof Error ? reason.message : String(reason)}`)));
    };

    image.onerror = (error: string | Event) => {
      URL.revokeObjectURL(image.src);
      console.warn('[DEV] Failed to load image blob for resizing.', { error });
      reject(new Error('Failed to load image blob for resizing.'));
    };

    // this starts the decoding
    image.src = URL.createObjectURL(imageBlob);
  });
}