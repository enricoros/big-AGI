import { canvasToDataURLAndMimeType } from './canvasUtils';

// configuration
const SKIP_LOADING_IN_DEV = false;

/**
 * Extracts text from a PDF file
 *
 * Uses the Next.js dynamic import feature to import the 'pdfjs-dist' library
 * only when this function is called. This allows the 'pdfjs-dist' library to
 * be bundled into a separate chunk, which is only loaded when this function
 * is called. This is useful because the 'pdfjs-dist' library is quite large,
 * and we don't want to load it unless we need to. [Faster startup time!]
 *
 * @param pdfBuffer The content of a PDF file
 * @param onProgress A callback function to report the progress of the text extraction
 */
export async function pdfToText(pdfBuffer: ArrayBuffer, onProgress: (progress: number) => void): Promise<string> {
  const { getDocument } = await dynamicImportPdfJs();
  if (!getDocument) {
    console.log('pdfToText: [dev] pdfjs-dist loading skipped');
    return '';
  }
  const pdf = await getDocument(pdfBuffer).promise;
  const textPages: string[] = []; // Initialize an array to hold text from all pages
  onProgress(0);

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i);
    onProgress(i / pdf.numPages);

    const content = await page.getTextContent();
    const strings = content.items
      .filter(isTextItem) // Use the type guard to filter out items with the 'str' property
      .map((item) => (item as { str: string }).str); // Use type assertion to ensure that the item has the 'str' property
    onProgress((i * 3 + 1) / (pdf.numPages * 3));

    // textPages.push(strings.join(' ')); // Add the joined strings to the array
    // New way: join the strings to form a page text. treat empty lines as newlines, otherwise join with a space (or not if the line is just 1 space)
    textPages.push(strings.reduce((acc, str) => {
      // empty line -> newline
      if (str === '')
        return acc + '\n';

      // single space
      if (str === ' ')
        return acc + str;

      // trick: de-hyphenation of consecutive lines
      if (/\w-$/.test(acc) && /^\w/.test(str))
        return acc.slice(0, -1) + str;

      // add a space if the last char is not a space or return (regex)
      if (/\S$/.test(acc))
        return acc + ' ' + str;

      // otherwise just concatenate
      return acc + str;
    }, ''));
    onProgress((i * 3 + 2) / (pdf.numPages * 3));
  }

  onProgress(1);
  return textPages.join('\n\n'); // Join all the page texts at the end
}


interface PdfPageImage {
  mimeType: string;
  base64Data: string;
  scale: number;
  width: number;
  height: number;
}

/**
 * Renders all pages of a PDF to images
 *
 * @param pdfBuffer The content of a PDF file
 * @param imageMimeType The MIME type of the image to render (default 'image/jpeg')
 * @param imageQuality The quality of the image (default 0.95 for moderate quality)
 * @param scale The scale factor for the image resolution (default 1.5 for moderate quality)
 * @param onProgress A callback function to report the progress of the image rendering
 */
export async function pdfToImageDataURLs(pdfBuffer: ArrayBuffer, imageMimeType: string, imageQuality: number /* = 0.95 */, scale: number /*= 1.5*/, onProgress: (progress: number) => void): Promise<PdfPageImage[]> {
  const { getDocument } = await dynamicImportPdfJs();
  if (!getDocument) {
    console.log('pdfToImageDataURLs: [dev] pdfjs-dist loading skipped');
    return [];
  }
  const pdf = await getDocument({ data: pdfBuffer }).promise;
  const images: PdfPageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {

    const page = await pdf.getPage(i);
    onProgress(i / pdf.numPages);

    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    onProgress((i * 3 + 1) / (pdf.numPages * 3));

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    // Convert canvas image to a DataURL string
    try {
      const { mimeType: actualMimeType, base64Data } = canvasToDataURLAndMimeType(canvas, imageMimeType, imageQuality, 'pdf-to-image');
      images.push({
        mimeType: actualMimeType,
        base64Data,
        scale,
        width: viewport.width,
        height: viewport.height,
      });
    } catch (error) {
      console.warn(`pdfToImageDataURLs: failed to convert image to ${imageMimeType}.`, { error });
    }
    onProgress((i * 3 + 2) / (pdf.numPages * 3));
  }

  onProgress(1);
  return images;
}


// Dynamically import the 'pdfjs-dist' library
async function dynamicImportPdfJs() {
  // https://github.com/vercel/turbo/issues/4795#issuecomment-2153074851
  // Disable loading 'pdfjs-dist' during development to make --turbo work
  if (SKIP_LOADING_IN_DEV && process.env.NODE_ENV === 'development') {
    return { getDocument: null };
  } else {
    // Dynamically import the 'pdfjs-dist' library [nextjs]
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');

    // Set the worker script path
    GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.min.mjs';

    return { getDocument };
  }
}

// Type guard to check if an item has a 'str' property
function isTextItem(item: any): item is { str: string } {
  return 'str' in item && typeof item.str === 'string';
}