/**
 * Copyright (c) 2024-2025 Enrico Ros
 *
 * Functions to deal with images from the frontend.
 * Also see videoUtils.ts for more image-related functions.
 */

import { Is } from './pwaUtils';
import { asyncCanvasToBlobWithValidation } from './canvasUtils';


// important platform values
export const PLATFORM_IMAGE_MIMETYPE: CommonImageMimeTypes = !Is.Browser.Safari ? 'image/webp' : 'image/jpeg';


// configuration
const HQ_SMOOTHING = true;
const DEFAULT_LOSSY_QUALITY = 0.96;
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


// ===== BLOB-BASED IMAGE UTILITIES =====

interface ImageTransformOptions {
  /** Resize mode for the image, if specified. */
  resizeMode?: LLMImageResizeMode,
  /** If unspecified, we'll use the PLATFORM_IMAGE_MIMETYPE (webp for chrome/firefox, jpeg for safari which doesn't encode webp) */
  convertToMimeType?: 'image/png' | 'image/jpeg' | 'image/webp',
  /** If specified, we'll use the DEFAULT_ADRAFT_IMAGE_QUALITY */
  convertToLossyQuality?: number, // 0-1, only used if convertToMimeType is lossy (jpeg or webp)
  /** If true, resize errors (image decode, canvas drawImage) will throw (default: false) Note that if the image does not need to be resized, this will not throw. */
  throwOnResizeError?: boolean,
  /** If true, type conversion errors (image type conversion) will throw (default: false) */
  throwOnTypeConversionError?: boolean,
  /** If set, prints conversion stats (if converted) to the console */
  debugConversionLabel?: string,
}

interface ImageTransformOperationResult extends ImageOperationResult {
  hasResized: boolean;
  hasTypeConverted: boolean;
  initialSize: number;
  initialType: string;
  // finalSize: number;
  // sizeRatio: number; // percentage difference in size compared to the initial size
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
  const toMimeType = options.convertToMimeType || PLATFORM_IMAGE_MIMETYPE;
  const toLossyQuality = options.convertToLossyQuality ?? DEFAULT_LOSSY_QUALITY;
  if (options.resizeMode) {

    // if null, resizing was not needed or possible (size could not be a fit)
    // this will throw an error if the resizeMode is not supported
    try {
      const resized = await imageBlobResizeIfNeeded(
        workingBlob,
        options.resizeMode,
        toMimeType,
        toLossyQuality,
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
        toLossyQuality,
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
  if (options.debugConversionLabel && (hasResized || hasTypeConverted)) {
    const finalSize = workingBlob.size;
    const sizeRatio = (initialSize && finalSize) ? Math.round(((finalSize - initialSize) / initialSize) * 100) : 1;
    console.log(`[${options.debugConversionLabel}] stored generated ${initialType} -> ${workingBlob.type} (quality:${toLossyQuality}, ${sizeRatio}% reduction, ${initialSize?.toLocaleString()} -> ${finalSize?.toLocaleString()})`);
  }

  return {
    blob: workingBlob,
    width: workingWidth,
    height: workingHeight,
    hasResized: hasResized,
    hasTypeConverted: hasTypeConverted,
    initialType: initialType,
    initialSize: initialSize,
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

      if (HQ_SMOOTHING) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
      }

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

      // multi-pass downscaling for better quality on large downscales (>2x)
      // progressively downscale by at most 2x per pass to reduce aliasing
      const scaleRatio = Math.max(originalWidth / newWidth, originalHeight / newHeight);
      const passes = (HQ_SMOOTHING && scaleRatio > 2) ? Math.min(4, Math.ceil(Math.log2(scaleRatio))) : 1;

      let currentDest: HTMLImageElement | HTMLCanvasElement = image;
      let currentWidth = originalWidth;
      let currentHeight = originalHeight;

      for (let pass = 0; pass < passes; pass++) {
        const isLastPass = pass === passes - 1;
        const targetWidth = isLastPass ? newWidth : Math.max(newWidth, Math.round(currentWidth / 2));
        const targetHeight = isLastPass ? newHeight : Math.max(newHeight, Math.round(currentHeight / 2));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx)
          return reject(new Error('Failed to get canvas context for resizing'));

        if (HQ_SMOOTHING) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
        }
        ctx.drawImage(currentDest, 0, 0, targetWidth, targetHeight);

        currentDest = canvas;
        currentWidth = targetWidth;
        currentHeight = targetHeight;
      }
      const finalCanvas = currentDest as HTMLCanvasElement;

      // Convert canvas to Blob with validation
      asyncCanvasToBlobWithValidation(finalCanvas, toMimeType, toLossyQuality, 'imageBlobResizeIfNeeded')
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