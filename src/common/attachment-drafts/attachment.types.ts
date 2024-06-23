import type { FileWithHandle } from 'browser-fs-access';

import type { DMessageAttachmentFragment, DMessageContentFragment } from '~/common/stores/chat/chat.fragments';


// Attachment Draft

export type AttachmentDraft = {
  readonly id: AttachmentDraftId;
  readonly source: AttachmentDraftSource,
  label: string;
  ref: string; // will be used in ```ref\n...``` for instance

  inputLoading: boolean;
  inputError: string | null;
  input?: AttachmentDraftInput;

  // options to convert the input
  converters: AttachmentDraftConverter[]; // List of available converters for this attachment
  converterIdx: number | null; // Index of the selected converter

  outputsConverting: boolean;
  outputFragments: DMessageAttachmentFragment[];

  // metadata: {
  //   creationDate?: Date; // Creation date of the file
  //   modifiedDate?: Date; // Last modified date of the file
  //   altText?: string; // Alternative text for images for screen readers
  // };
};

export type AttachmentDraftId = string;


// draft source

export type AttachmentDraftSource = {
  media: 'url';
  url: string;
  refUrl: string;
} | {
  media: 'file';
  origin: AttachmentDraftSourceOriginFile,
  fileWithHandle: FileWithHandle;
  refPath: string;
} | {
  media: 'text';
  method: 'clipboard-read' | AttachmentDraftSourceOriginDTO;
  textPlain?: string;
  textHtml?: string;
} | {
  // special type for attachments thar are references to self (ego, application) objects
  media: 'ego';
  method: 'ego-contents';
  contents: DMessageContentFragment[];
  label: string;
  refId: string; // message ID where the context came from (unused..)
};

export type AttachmentDraftSourceOriginFile = 'camera' | 'screencapture' | 'file-open' | 'clipboard-read' | AttachmentDraftSourceOriginDTO;

export type AttachmentDraftSourceOriginDTO = 'drop' | 'paste';


// draft input

export type AttachmentDraftInput = {
  mimeType: string; // Original MIME type of the file
  data: string | ArrayBuffer | DMessageContentFragment[]; // The original data of the attachment
  dataSize: number; // Size of the original data in bytes
  altMimeType?: string; // Alternative MIME type for the input
  altData?: string; // Alternative data for the input
  // preview?: AttachmentPreview; // Preview of the input
};


// draft converter

export type AttachmentDraftConverter = {
  id: AttachmentDraftConverterType;
  name: string;
  disabled?: boolean;
  unsupported?: boolean;
  // outputType: ComposerOutputPartType; // The type of the output after conversion
  // isAutonomous: boolean; // Whether the conversion does not require user input
  // isAsync: boolean; // Whether the conversion is asynchronous
  // progress: number; // Conversion progress percentage (0..1)
  // errorMessage?: string; // Error message if the conversion failed
}

export type AttachmentDraftConverterType =
  | 'text' | 'rich-text' | 'rich-text-table'
  | 'pdf-text' | 'pdf-images'
  | 'image-original' | 'image-resized-high' | 'image-resized-low' | 'image-ocr' | 'image-to-default'
  | 'ego-contents-inlined'
  | 'unhandled';


/*export type AttachmentDraftPreview = {
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
