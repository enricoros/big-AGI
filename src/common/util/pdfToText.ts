// Type guard to check if an item has a 'str' property
function isTextItem(item: any): item is { str: string } {
  return 'str' in item && typeof item.str === 'string';
}

/**
 * Extracts text from a PDF file
 *
 * Uses the Next.js dynamic import feature to import the 'pdfjs-dist' library
 * only when this function is called. This allows the 'pdfjs-dist' library to
 * be bundled into a separate chunk, which is only loaded when this function
 * is called. This is useful because the 'pdfjs-dist' library is quite large,
 * and we don't want to load it unless we need to. [Faster startup time!]
 *
 * @param file - The PDF file to extract text from
 */
export const pdfToText = async (file: File): Promise<string> => {

  // Dynamically import the 'pdfjs-dist' library [nextjs]
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');

  // Set the worker script path
  GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.min.js';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument(arrayBuffer).promise;
  let text = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      .filter(isTextItem) // Use the type guard to filter out items with the 'str' property
      .map(item => (item as { str: string }).str); // Use type assertion to ensure that the item has the 'str' property
    text += strings.join(' ') + '\n';
  }

  return text;
};