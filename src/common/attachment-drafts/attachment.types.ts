import type { FileWithHandle } from 'browser-fs-access';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DMessageAttachmentFragment, DMessageFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessageId } from '~/common/stores/chat/chat.message';


// Attachment Draft

export type AttachmentDraft = {
  readonly id: AttachmentDraftId;
  readonly source: AttachmentDraftSource,
  label: string;  // what's written in the button, such as a web page `title`
  ref: string;    // will be used in ```ref\n...``` for instance the web page `url`

  inputLoading: boolean;
  inputError: string | null;
  input?: AttachmentDraftInput;

  // options to convert the input
  converters: AttachmentDraftConverter[]; // List of available converters for this attachment

  outputsConverting: boolean;
  outputsConversionProgress: number | null;
  outputFragments: DMessageAttachmentFragment[];

  // metadata: {
  //   creationDate?: Date; // Creation date of the file
  //   modifiedDate?: Date; // Last modified date of the file
  //   altText?: string; // Alternative text for images for screen readers
  // };
};

export type AttachmentDraftId = string;


// 0. draft source (filled at the onset)

export type AttachmentDraftSource = {
  media: 'url';
  url: string; // parsed valid url
  refUrl: string; // original text (use this as text ref, otherwise use the url)
} | {
  media: 'file';
  origin: AttachmentDraftSourceOriginFile,
  fileWithHandle: FileWithHandle;
  refPath: string; // original file name, or path/to/file name
} | {
  media: 'text';
  method: 'clipboard-read' | AttachmentDraftSourceOriginDTO;
  textPlain?: string;
  textHtml?: string;
} | {
  // special type for attachments thar are references to self (ego, application) objects
  media: 'ego';
  method: 'ego-fragments';
  label: string;
  egoFragmentsInputData: DraftEgoFragmentsInputData;
};

export type AttachmentDraftSourceOriginFile = 'camera' | 'screencapture' | 'file-open' | 'clipboard-read' | AttachmentDraftSourceOriginDTO;

export type AttachmentDraftSourceOriginDTO = 'drop' | 'paste';

export type AttachmentCreationOptions = {
  hintAddImages?: boolean;
}


// 1. draft input (loaded from the source)

export type AttachmentDraftInput = {
  mimeType: string; // Original MIME type of the file, or application specific type
  data: string | ArrayBuffer | DraftWebInputData | DraftYouTubeInputData | DraftEgoFragmentsInputData; // The original data of the attachment
  dataSize?: number; // Size of the original data (for plain/simple 1:1 mime)
  altMimeType?: string; // Alternative MIME type for the input
  altData?: string; // Alternative data for the input
  // [media:URL] special for download inputs
  urlImage?: {
    imgDataUrl: string;
    mimeType: string;
    width: number;
    height: number;
    // to discriminate the source
    generator: 'web-capture' | 'youtube-thumbnail';
    timestamp: number; // Unix timestamp
  };
  // preview?: AttachmentPreview; // Preview of the input
};

export type DraftWebInputData = {
  pageText?: string;
  pageMarkdown?: string;
  pageCleanedHtml?: string;
  pageTitle?: string;
}

export type DraftYouTubeInputData = {
  videoId: string;
  videoTitle: string;
  videoDescription: string;
  videoThumbnailUrl: string;
  videoTranscript: string;
}

export type DraftEgoFragmentsInputData = {
  fragments: DMessageFragment[];
  conversationTitle: string;
  conversationId: DConversationId;
  messageId: DMessageId;
}


// 2. draft converters (UI options to convert the input)

export type AttachmentDraftConverter = {
  id: AttachmentDraftConverterType;
  name: string;
  disabled?: boolean;
  unsupported?: boolean;
  isCheckbox?: boolean; // renders as checkbox and is not exclusive with the others

  // runtime properties
  isActive?: boolean; // checked, for both radio (mutually exclusive) and checkbox (additional) converters

  // outputType: ComposerOutputPartType; // The type of the output after conversion
  // isAutonomous: boolean; // Whether the conversion does not require user input
  // isAsync: boolean; // Whether the conversion is asynchronous
  // progress: number; // Conversion progress percentage (0..1)
  // errorMessage?: string; // Error message if the conversion failed
}

export type AttachmentDraftConverterType =
  | 'text' | 'rich-text' | 'rich-text-cleaner' | 'rich-text-table'
  | 'image-original' | 'image-resized-high' | 'image-resized-low' | 'image-ocr' | 'image-to-default'
  | 'pdf-text' | 'pdf-images' | 'pdf-text-and-images'
  | 'docx-to-html'
  | 'url-page-text' | 'url-page-markdown' | 'url-page-html' | 'url-page-null' | 'url-page-image'
  | 'youtube-transcript' | 'youtube-transcript-simple'
  | 'ego-fragments-inlined'
  | 'unhandled';


// 3. Output - this is done via DMessageAttachmentFragment[], to be directly compatible with our data


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
