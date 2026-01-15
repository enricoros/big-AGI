/**
 * Shared OCR utilities using Tesseract.js
 *
 * Used by:
 * - image-ocr converter (single image)
 * - pdf-auto converter (multi-page fallback)
 * - pdf-images-ocr converter (forced OCR on PDF pages)
 */

import type { recognize as TesseractRecognize } from 'tesseract.js';

// Cache the Tesseract module to avoid re-importing on every call
let cachedRecognize: typeof TesseractRecognize | null = null;

async function getTesseractRecognize(): Promise<typeof TesseractRecognize> {
  if (!cachedRecognize) {
    const tesseract = await import('tesseract.js');
    cachedRecognize = tesseract.recognize;
  }
  return cachedRecognize;
}


/**
 * Result of OCR operation with quality metadata
 */
export interface OcrResult {
  text: string;
  avgCharsPerPage: number;
  pageCount: number;
}


/**
 * OCR a single image with progress tracking
 *
 * @param imageData - Blob or base64 data URL
 * @param onProgress - Progress callback (0-1)
 * @returns Extracted text
 */
export async function ocrImageWithProgress(
  imageData: Blob | string,
  onProgress?: (progress: number) => void,
): Promise<string> {
  const recognize = await getTesseractRecognize();
  let lastProgress = -1;

  const { data: page } = await recognize(imageData, undefined, {
    errorHandler: e => {
      // NOTE: shall we inform the user about the error?
      console.error('[OCR Error]', e);
    },
    logger: (message) => {
      if (!onProgress || message.status !== 'recognizing text')
        return;
      if (message.progress > lastProgress + 0.01) {
        lastProgress = message.progress;
        onProgress(message.progress);
      }
    },
  });

  console.log('OCR', {page});

  return page.text;
}


/**
 * OCR multiple PDF page images with cumulative progress tracking
 *
 * @param imageDataURLs - Array of rendered PDF page images
 * @param onProgress - Progress callback (0-1, cumulative across all pages)
 * @returns Combined text from all pages with quality metadata
 */
export async function ocrPdfPagesWithProgress(
  imageDataURLs: Array<{ mimeType: string; base64Data: string }>,
  onProgress?: (progress: number) => void,
): Promise<OcrResult> {

  const pageTexts: string[] = [];
  const totalPages = imageDataURLs.length;

  for (let pageNum = 0; pageNum < totalPages; pageNum++) {
    const pageImage = imageDataURLs[pageNum];

    // Convert base64 to data URL for Tesseract
    const dataUrl = `data:${pageImage.mimeType};base64,${pageImage.base64Data}`;
    const pageText = await ocrImageWithProgress(dataUrl,
      (pageProgress) => {
        // Distribute progress across all pages
        const cumulativeProgress = (pageNum + pageProgress) / totalPages;
        onProgress?.(cumulativeProgress);
      },
    );

    pageTexts.push(pageText);

    // Update progress after each page completes
    onProgress?.((pageNum + 1) / totalPages);
  }

  // Combine pages with informative separators for multi-page PDFs
  const combinedText = pageTexts
    .map((text, i) => `--- Page ${i + 1}/${totalPages} (OCR) ---\n\n${text}`)
    .join('\n\n') + `\n\n--- End of OCR Document | If content is missing or garbled, re-attach PDF as images ---`;

  const trimmedLength = combinedText.trim().length;

  return {
    text: combinedText,
    pageCount: totalPages,
    avgCharsPerPage: totalPages > 0 ? trimmedLength / totalPages : 0,
  };
}
