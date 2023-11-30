import { AttachmentConversion, ConversionOutputType } from './conversions';
import { FileWithHandle } from 'browser-fs-access';


// Attachment Types

export type AttachmentId = string;

// export type AttachmentSourceType = 'file' | 'image' | 'video' | 'audio' | 'link' | 'text';

// export type AttachmentStatus = 'pending' | 'converting' | 'completed' | 'failed';

export type AttachmentDTOrigin = 'drop' | 'paste';
export type AttachmentFileOrigin = 'camera' | 'file-open' | 'clipboard-read' | AttachmentDTOrigin;

export type AttachmentSource = {
  type: 'url';
  url: string;
  refName: string;
} | {
  type: 'file';
  origin: AttachmentFileOrigin,
  fileWithHandle: FileWithHandle;
  name: string;
} | {
  type: 'text';
  method: 'clipboard-read' | AttachmentDTOrigin;
  textPlain?: string;
  textHtml?: string;
};

export type Attachment = {
  readonly id: AttachmentId;
  label: string | undefined;
  readonly source: AttachmentSource,
  input?: {
    // data: string; // The original data of the attachment (...string | Blob | ArrayBuffer ?)
    mimeType: string; // Original MIME type of the file
    // preview?: AttachmentPreview; // Preview of the input
  };
  availableConversions?: AttachmentConversion[]; // List of available conversions for this attachment
  conversion?: AttachmentConversion; // The conversion currently being applied or last applied
  output?: {
    outputType: ConversionOutputType; // The type of the output after conversion
    dataTitle: string; // outputType dependent
    data: string; // outputType dependent
    preview?: AttachmentPreview; // Preview of the output
    isEjectable: boolean; // Whether the attachment can be inlined as text
  };
  metadata: {
    size?: number; // Size of the attachment in bytes
    creationDate?: Date; // Creation date of the file
    modifiedDate?: Date; // Last modified date of the file
    altText?: string; // Alternative text for images for screen readers
  };
};

export type AttachmentPreview = {
  renderer: 'noPreview',
  title: string; // A title for the preview
} | {
  renderer: 'textPreview'
  fileName: string; // The name of the file
  snippet: string; // A text snippet for documents
  tooltip?: string; // A tooltip for the preview
} | {
  renderer: 'imagePreview'
  thumbnail: string; // A thumbnail preview for images, videos, etc.
  tooltip?: string; // A tooltip for the preview
};