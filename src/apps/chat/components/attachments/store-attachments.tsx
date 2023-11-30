import { create } from 'zustand';

import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { createBase36Uid } from '~/common/util/textUtils';

import { Attachment, AttachmentId, AttachmentInput, AttachmentSource } from './attachment.types';


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

      _set({
        attachments: [...attachments, attachment],
      });

      const edit = (changes: Partial<Attachment>) => editAttachment(attachment.id, changes);

      resolveInputAsync(attachment.source, edit)
        .then(() => {
          const updatedAttachment = _get().getAttachment(attachment.id);
          if (updatedAttachment?.input)
            defineConversions(updatedAttachment.input, edit);
          // else
          //   edit({ sourceError: 'No content found' });
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


function createAttachment(source: AttachmentSource, checkDuplicates: AttachmentId[]): Attachment {
  return {
    id: createBase36Uid(checkDuplicates),
    label: 'Loading...',
    source: source,
    sourceLoading: false,
    sourceError: null,
    input: undefined,
    availableConversions: undefined,
    outputs: undefined,
    // metadata: {},
  };
}

/**
 * Source (URL, file, ..) -> Input data
 */
async function resolveInputAsync(source: AttachmentSource, edit: (changes: Partial<Attachment>) => void) {
  // show the loading indicator
  edit({ sourceLoading: true });

  switch (source.type) {

    // Download URL (page, file, ..) and attach as input
    case 'url':
      edit({ label: source.refName });
      try {
        const page = await callBrowseFetchPage(source.url);
        if (page.content) {
          edit({
            input: {
              mimeType: 'text/plain',
              data: page.content,
              dataSize: page.content.length,
              // preview...
            },
          });
        } else
          edit({ sourceError: 'No content found at this link' });
      } catch (error: any) {
        edit({ sourceError: `Issue downloading page: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}` });
      }
      break;

    // Attach file as input
    case 'file':
      edit({ label: source.name });
      try {
        const fileArrayBuffer = await source.fileWithHandle.arrayBuffer();
        edit({
          input: {
            mimeType: source.fileWithHandle.type,
            data: fileArrayBuffer,
            dataSize: fileArrayBuffer.byteLength,
          },
        });
      } catch (error: any) {
        edit({ sourceError: `Issue loading file: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}` });
      }
      break;

    case 'text':
      if (source.textHtml && source.textPlain) {
        edit({
          label: 'Text+',
          input: {
            mimeType: 'text/plain',
            data: source.textPlain,
            dataSize: source.textPlain!.length,
            altMimeType: 'text/html',
            altData: source.textHtml,
          },
        });
      } else {
        const text = source.textHtml || source.textPlain || '';
        edit({
          label: 'Text',
          input: {
            mimeType: 'text/plain',
            data: text,
            dataSize: text.length,
          },
        });
      }
      break;
  }

  // done loading
  edit({ sourceLoading: false });
}

/**
 * Input data -> Conversions
 */
function defineConversions(input: AttachmentInput, edit: (changes: Partial<Attachment>) => void) {

  edit({
    availableConversions: [],
  });

  console.log('defineConversions', input);
  // setComposeText(expandPromptTemplate(PromptTemplates.PasteFile, { fileName, fileText: urlContent }));

  return undefined;
}


