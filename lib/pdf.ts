import { getDocument } from 'pdfjs-dist';

// Type guard to check if an item has a 'str' property
function isTextItem(item: any): item is { str: string } {
  return 'str' in item && typeof item.str === 'string';
}

export const convertPdfFileToMdDirect = async (pdfFile: File): Promise<string> => {
  if (typeof window !== 'undefined') {
    const pdfjs = require('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = '/workers/pdf.worker.js';
  }

  const reader = new FileReader();
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(pdfFile);
  });

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
  console.log('pdf content:', text);
  return text;
};