import type { FileWithHandle } from 'browser-fs-access';

import type { DAttachmentPart } from '~/common/stores/chat/chat.message';


// Attachment

export type Attachment = {
  readonly id: AttachmentId;
  readonly source: AttachmentSource,
  label: string;
  ref: string; // will be used in ```ref\n...``` for instance

  inputLoading: boolean;
  inputError: string | null;
  input?: AttachmentInput;

  // options to convert the input
  converters: AttachmentConverter[]; // List of available converters for this attachment
  converterIdx: number | null; // Index of the selected converter

  outputsConverting: boolean;
  outputs: DAttachmentPart[]; // undefined: not yet converted, []: conversion failed, [ {}+ ]: conversion succeeded

  // metadata: {
  //   size?: number; // Size of the attachment in bytes
  //   creationDate?: Date; // Creation date of the file
  //   modifiedDate?: Date; // Last modified date of the file
  //   altText?: string; // Alternative text for images for screen readers
  // };
};

export type AttachmentId = string;


// attachment source

export type AttachmentSource = {
  media: 'url';
  url: string;
  refUrl: string;
} | {
  media: 'file';
  origin: AttachmentSourceOriginFile,
  fileWithHandle: FileWithHandle;
  refPath: string;
} | {
  media: 'text';
  method: 'clipboard-read' | AttachmentSourceOriginDTO;
  textPlain?: string;
  textHtml?: string;
} | {
  // special type for attachments thar are references to self (ego, application) objects
  media: 'ego';
  method: 'ego-message';
  label: string;
  blockTitle: string;
  textPlain: string;
};

export type AttachmentSourceOriginFile = 'camera' | 'screencapture' | 'file-open' | 'clipboard-read' | AttachmentSourceOriginDTO;

export type AttachmentSourceOriginDTO = 'drop' | 'paste';


// attachment input

export type AttachmentInput = {
  mimeType: string; // Original MIME type of the file
  data: string | ArrayBuffer; // The original data of the attachment
  dataSize: number; // Size of the original data in bytes
  altMimeType?: string; // Alternative MIME type for the input
  altData?: string; // Alternative data for the input
  // preview?: AttachmentPreview; // Preview of the input
};


// attachment converter

export type AttachmentConverter = {
  id: AttachmentConverterType;
  name: string;
  disabled?: boolean;
  unsupported?: boolean;
  // outputType: ComposerOutputPartType; // The type of the output after conversion
  // isAutonomous: boolean; // Whether the conversion does not require user input
  // isAsync: boolean; // Whether the conversion is asynchronous
  // progress: number; // Conversion progress percentage (0..1)
  // errorMessage?: string; // Error message if the conversion failed
}

export type AttachmentConverterType =
  | 'text' | 'rich-text' | 'rich-text-table'
  | 'pdf-text' | 'pdf-images'
  | 'image' | 'image-ocr' | 'image-to-webp'
  | 'ego-message-md'
  | 'unhandled';


/*export type AttachmentPreview = {
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
};*/
