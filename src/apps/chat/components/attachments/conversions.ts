export type ConversionName = 'urlToText' | 'pdfToText' | 'imageToText' | 'imageToDescription';

export type ConversionOutputType = 'app-text' | 'app-image';

export type AttachmentConversion = {
  type: ConversionName; // The type of conversion
  outputType: ConversionOutputType; // The type of the output after conversion
  status: 'pending' | 'converting' | 'completed' | 'failed'; // The status of the conversion
  isAutonomous: boolean; // Whether the conversion does not require user input
  isAsync: boolean; // Whether the conversion is asynchronous
  progress: number; // Conversion progress percentage (0..1)
  errorMessage?: string; // Error message if the conversion failed
};

type AttachmentConversionTarget = {
  outputType: ConversionOutputType;
  conversionName: ConversionName;
};

const attachmentsConversionMap: { [inputType: string]: AttachmentConversionTarget[]; } = {
  'application/pdf': [
    { outputType: 'app-text', conversionName: 'pdfToText' }, // You'll need to implement this function
    // ... other converters
  ],
  'image/*': [
    { outputType: 'app-text', conversionName: 'imageToText' }, // OCR conversion
    { outputType: 'app-text', conversionName: 'imageToDescription' }, // Image description conversion
    // ... other converters
  ],
  // ... other input types
};


export function getAvailableConversions(attachmentType: string): AttachmentConversion[] {
  return [];
  // return conversionMap[attachmentType] || [];
}