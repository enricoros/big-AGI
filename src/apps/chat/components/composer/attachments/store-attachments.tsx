import { create } from 'zustand';
import type { FileWithHandle } from 'browser-fs-access';

import type { ComposerOutputMultiPart } from '../composer.types';
import { attachmentCreate, attachmentDefineConverters, attachmentLoadInputAsync, attachmentPerformConversion } from './pipeline';


// Attachment Types

export type AttachmentSourceOriginDTO = 'drop' | 'paste';
export type AttachmentSourceOriginFile = 'camera' | 'screencapture' | 'file-open' | 'clipboard-read' | AttachmentSourceOriginDTO;

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
  media: 'ego';
  method: 'ego-message';
  label: string;
  blockTitle: string;
  textPlain: string;
};


export type AttachmentInput = {
  mimeType: string; // Original MIME type of the file
  data: string | ArrayBuffer; // The original data of the attachment
  dataSize: number; // Size of the original data in bytes
  altMimeType?: string; // Alternative MIME type for the input
  altData?: string; // Alternative data for the input
  // preview?: AttachmentPreview; // Preview of the input
};


export type AttachmentConverterType =
  | 'text' | 'rich-text' | 'rich-text-table'
  | 'pdf-text' | 'pdf-images'
  | 'image' | 'image-ocr'
  | 'ego-message-md'
  | 'unhandled';

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


export type AttachmentId = string;

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
  outputs: ComposerOutputMultiPart; // undefined: not yet converted, []: conversion failed, [ {}+ ]: conversion succeeded

  // metadata: {
  //   size?: number; // Size of the attachment in bytes
  //   creationDate?: Date; // Creation date of the file
  //   modifiedDate?: Date; // Last modified date of the file
  //   altText?: string; // Alternative text for images for screen readers
  // };
};


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


/// Store

interface AttachmentsStore {

  attachments: Attachment[];

  createAttachment: (source: AttachmentSource) => Promise<void>;
  clearAttachments: () => void;
  removeAttachment: (attachmentId: AttachmentId) => void;
  moveAttachment: (attachmentId: AttachmentId, delta: 1 | -1) => void;
  setConverterIdx: (attachmentId: AttachmentId, converterIdx: number | null) => Promise<void>;

  _editAttachment: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) => void;
  _getAttachment: (attachmentId: AttachmentId) => Attachment | undefined;

}

export const useAttachmentsStore = create<AttachmentsStore>()(
  (_set, _get) => ({

    attachments: [],

    createAttachment: async (source: AttachmentSource) => {
      const { attachments, _getAttachment, _editAttachment, setConverterIdx } = _get();

      const attachment = attachmentCreate(source, attachments.map(a => a.id));

      _set({
        attachments: [...attachments, attachment],
      });

      const editFn = (changes: Partial<Attachment>) => _editAttachment(attachment.id, changes);

      // 1.Resolve the Input
      await attachmentLoadInputAsync(source, editFn);
      const loaded = _getAttachment(attachment.id);
      if (!loaded || !loaded.input)
        return;

      // 2. Define the I->O Converters
      attachmentDefineConverters(source.media, loaded.input, editFn);
      const defined = _getAttachment(attachment.id);
      if (!defined || !defined.converters.length || defined.converterIdx !== null)
        return;

      // 3. Select the first Converter
      const firstEnabledIndex = defined.converters.findIndex(_c => !_c.disabled);
      await setConverterIdx(attachment.id, firstEnabledIndex > -1 ? firstEnabledIndex : 0);
    },

    clearAttachments: () => _set({
      attachments: [],
    }),

    removeAttachment: (attachmentId: AttachmentId) =>
      _set(state => ({
        attachments: state.attachments.filter(attachment => attachment.id !== attachmentId),
      })),

    moveAttachment: (attachmentId: AttachmentId, delta: 1 | -1) =>
      _set(state => {
        const attachments = [...state.attachments];
        const currentIdx = attachments.findIndex(a => a.id === attachmentId);

        // If the attachment is not found, or if trying to move beyond the array boundaries, no move is needed
        if (currentIdx === -1 || (currentIdx === 0 && delta === -1) || (currentIdx === attachments.length - 1 && delta === 1))
          return state;

        // Swap the attachment with the adjacent one in the direction of delta
        const targetIdx = currentIdx + delta;
        [attachments[currentIdx], attachments[targetIdx]] = [attachments[targetIdx], attachments[currentIdx]];

        return { attachments };
      }),

    setConverterIdx: async (attachmentId: AttachmentId, converterIdx: number | null) => {
      const { _getAttachment, _editAttachment } = _get();
      const attachment = _getAttachment(attachmentId);
      if (!attachment || attachment.converterIdx === converterIdx)
        return;

      const editFn = (changes: Partial<Attachment>) => _editAttachment(attachmentId, changes);

      await attachmentPerformConversion(attachment, converterIdx, editFn);
    },

    _editAttachment: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) =>
      _set(state => ({
        attachments: state.attachments.map((attachment: Attachment): Attachment =>
          attachment.id === attachmentId
            ? { ...attachment, ...(typeof update === 'function' ? update(attachment) : update) }
            : attachment,
        ),
      })),

    _getAttachment: (attachmentId: AttachmentId) =>
      _get().attachments.find(a => a.id === attachmentId),

  }),
);
