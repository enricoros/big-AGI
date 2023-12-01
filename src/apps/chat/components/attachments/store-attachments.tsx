import { create } from 'zustand';
import type { FileWithHandle } from 'browser-fs-access';

import type { AttachmentConversion } from './logic/conversions';
import { attachmentDefineConversions, attachmentResolveInputAsync, createAttachment } from './logic';


// Attachment Types

export type AttachmentId = string;
export type AttachmentDTOrigin = 'drop' | 'paste';
export type AttachmentFileOrigin = 'camera' | 'file-open' | 'clipboard-read' | AttachmentDTOrigin;
type AttachmenTextOrigin = 'clipboard-read' | AttachmentDTOrigin;

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
  method: AttachmenTextOrigin;
  textPlain?: string;
  textHtml?: string;
};

export type AttachmentInput = {
  mimeType: string; // Original MIME type of the file
  data: string | ArrayBuffer; // The original data of the attachment (...string | Blob | ArrayBuffer ?)
  dataSize: number; // Size of the original data in bytes
  altMimeType?: string; // Alternative MIME type for the input
  altData?: string; // Alternative data for the input
  // preview?: AttachmentPreview; // Preview of the input
};

export type Attachment = {
  readonly id: AttachmentId;
  label: string;

  // source: URL / File / text; content and type to be resolved later
  readonly source: AttachmentSource,
  sourceLoading: boolean;
  sourceError: string | null;

  // set after the source has been loaded/processe
  input?: AttachmentInput;

  // options to convert the input
  conversions: AttachmentConversion[]; // List of available conversions for this attachment
  conversionIdx: number | null; // Index of the selected conversion

  outputs?: {
    // outputType: ConversionOutputType; // The type of the output after conversion
    // dataTitle: string; // outputType dependent
    // data: string; // outputType dependent
    // preview?: AttachmentPreview; // Preview of the output
    isEjectable: boolean; // Whether the attachment can be inlined as text
  }[];
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

  getAttachment: (attachmentId: AttachmentId) => Attachment | undefined;

  createAttachment: (sources: AttachmentSource) => void;
  clearAttachments: () => void;
  removeAttachment: (attachmentId: AttachmentId) => void;
  editAttachment: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) => void;

}

export const useAttachmentsStore = create<AttachmentsStore>()(
  (_set, _get) => ({

    attachments: [],

    getAttachment: (attachmentId: AttachmentId) =>
      _get().attachments.find(a => a.id === attachmentId),

    createAttachment: (source: AttachmentSource) => {
      const { attachments, editAttachment } = _get();
      const attachment = createAttachment(source, attachments.map(a => a.id));
      const attachmentId = attachment.id;

      _set({
        attachments: [...attachments, attachment],
      });

      const edit = (changes: Partial<Attachment>) => editAttachment(attachmentId, changes);

      attachmentResolveInputAsync(attachment.source, edit).then(() => {
        const attachment = _get().getAttachment(attachmentId);
        if (attachment?.input)
          attachmentDefineConversions(attachment.input, edit);
        // no need for an 'else' case, as a loading error was set for sure
      });
    },

    clearAttachments: () => _set({
      attachments: [],
    }),

    removeAttachment: (attachmentId: AttachmentId) =>
      _set(state => ({
        attachments: state.attachments.filter(attachment => attachment.id !== attachmentId),
      })),

    editAttachment: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) =>
      _set(state => ({
        attachments: state.attachments.map((attachment: Attachment): Attachment =>
          attachment.id === attachmentId
            ? { ...attachment, ...(typeof update === 'function' ? update(attachment) : update) }
            : attachment,
        ),
      })),

  }),
);
