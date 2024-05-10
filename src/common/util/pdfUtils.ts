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
 */
export async function pdfToText(pdfBuffer: ArrayBuffer): Promise<string> {
  const { getDocument } = await dynamicImportPdfJs();
  const pdf = await getDocument(pdfBuffer).promise;
  const textPages: string[] = []; // Initialize an array to hold text from all pages

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter(isTextItem) // Use the type guard to filter out items with the 'str' property
      .map((item) => (item as { str: string }).str); // Use type assertion to ensure that the item has the 'str' property

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
  }
  return textPages.join('\n\n'); // Join all the page texts at the end
}


type PdfPageImage = { base64Url: string, scale: number, width: number, height: number };

/**
 * Renders all pages of a PDF to images
 *
 * @param pdfBuffer The content of a PDF file
 * @param scale The scale factor for the image resolution (default 1.5 for moderate quality)
 */
export async function pdfToImageDataURLs(pdfBuffer: ArrayBuffer, scale = 1.5): Promise<PdfPageImage[]> {
  const { getDocument } = await dynamicImportPdfJs();
  const pdf = await getDocument({ data: pdfBuffer }).promise;
  const images: PdfPageImage[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context!,
      viewport,
    }).promise;

    images.push({
      base64Url: canvas.toDataURL('image/jpeg'),
      scale,
      width: viewport.width,
      height: viewport.height,
    });
  }

  return images;
}


// Dynamically import the 'pdfjs-dist' library
async function dynamicImportPdfJs() {
  // Dynamically import the 'pdfjs-dist' library [nextjs]
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');

  // Set the worker script path
  GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.min.mjs';

  return { getDocument };
}

// Type guard to check if an item has a 'str' property
function isTextItem(item: any): item is { str: string } {
  return 'str' in item && typeof item.str === 'string';
}