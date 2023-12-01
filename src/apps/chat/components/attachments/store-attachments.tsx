import { create } from 'zustand';
import type { FileWithHandle } from 'browser-fs-access';

import { attachmentConvert, attachmentCreate, attachmentDefineConversions, attachmentLoadInputAsync } from './pipeline';


// Attachment Types

export type AttachmentId = string;
export type AttachmentDTOrigin = 'drop' | 'paste';
export type AttachmentFileOrigin = 'camera' | 'file-open' | 'clipboard-read' | AttachmentDTOrigin;
export type AttachmentConversionType =
  | 'text' | 'rich-text' | 'rich-text-table'
  | 'pdf-text' | 'pdf-images'
  | 'image' | 'image-ocr'
  | 'unhandled';

export type AttachmentSource = {
  media: 'url';
  url: string;
  refUrl: string;
} | {
  media: 'file';
  origin: AttachmentFileOrigin,
  fileWithHandle: FileWithHandle;
  refPath: string;
} | {
  media: 'text';
  method: 'clipboard-read' | AttachmentDTOrigin;
  textPlain?: string;
  textHtml?: string;
};

export type AttachmentInput = {
  mimeType: string; // Original MIME type of the file
  data: string | ArrayBuffer; // The original data of the attachment
  dataSize: number; // Size of the original data in bytes
  altMimeType?: string; // Alternative MIME type for the input
  altData?: string; // Alternative data for the input
  // preview?: AttachmentPreview; // Preview of the input
};

export type AttachmentConversion = {
  id: AttachmentConversionType;
  name: string;
  disabled?: boolean;
  // outputType: ConversionOutputType; // The type of the output after conversion
  // isAutonomous: boolean; // Whether the conversion does not require user input
  // isAsync: boolean; // Whether the conversion is asynchronous
  // progress: number; // Conversion progress percentage (0..1)
  // errorMessage?: string; // Error message if the conversion failed
}

export type AttachmentOutput = {
  type: 'text-block',
  text: string,
  isEjectable: true,
}

export type Attachment = {
  readonly id: AttachmentId;
  readonly source: AttachmentSource,
  label: string;

  inputLoading: boolean;
  inputError: string | null;
  input?: AttachmentInput;

  // options to convert the input
  conversions: AttachmentConversion[]; // List of available conversions for this attachment
  conversionIdx: number | null; // Index of the selected conversion

  outputs?: AttachmentOutput[];
  // {
  // dataTitle: string; // outputType dependent
  // data: string; // outputType dependent
  // preview?: AttachmentPreview; // Preview of the output
  // isEjectable: boolean; // Whether the attachment can be inlined as text
  // }[];

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
  setConversionIdx: (attachmentId: AttachmentId, conversionIdx: number | null) => Promise<void>;

  _editAttachment: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) => void;
  _getAttachment: (attachmentId: AttachmentId) => Attachment | undefined;

}

export const useAttachmentsStore = create<AttachmentsStore>()(
  (_set, _get) => ({

    attachments: [],

    createAttachment: async (source: AttachmentSource) => {
      const { attachments, _getAttachment, _editAttachment, setConversionIdx } = _get();

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

      // 2. Define the I->O Conversions
      attachmentDefineConversions(source.media, loaded.input, editFn);
      const defined = _getAttachment(attachment.id);
      if (!defined || !defined.conversions.length || defined.conversionIdx !== null)
        return;

      // 3. Select the first Conversion
      const firstEnabledIndex = defined.conversions.findIndex(_c => !_c.disabled);
      await setConversionIdx(attachment.id, firstEnabledIndex > -1 ? firstEnabledIndex : 0);
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

    setConversionIdx: async (attachmentId: AttachmentId, conversionIdx: number | null) => {
      const { _getAttachment, _editAttachment } = _get();
      const attachment = _getAttachment(attachmentId);
      if (!attachment || attachment.conversionIdx === conversionIdx)
        return;

      const editFn = (changes: Partial<Attachment>) => _editAttachment(attachmentId, changes);

      await attachmentConvert(attachment, conversionIdx, editFn);
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
