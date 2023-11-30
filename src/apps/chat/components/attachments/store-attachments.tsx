import { create } from 'zustand';

import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { createBase36Uid } from '~/common/util/textUtils';

import type { Attachment, AttachmentId, AttachmentSource } from './attachment.types';
import { pdfToText } from './pdfToText';


interface AttachmentsStore {

  attachments: Attachment[];

  createAttachment: (sources: AttachmentSource) => void;
  clearAttachments: () => void;
  removeAttachment: (attachmentId: AttachmentId) => void;
  editItem: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) => void;

}

export const useAttachmentsStore = create<AttachmentsStore>()(
  (_set, _get) => ({

    attachments: [],

    createAttachment: (source: AttachmentSource) => {
      const { attachments, editItem } = _get();
      const attachment = createAttachment(source, attachments.map(a => a.id));

      _set({
        attachments: [...attachments, attachment],
      });

      resolveInputAsync(attachment.source, (changes: Partial<Attachment>) => editItem(attachment.id, changes))
        .then(() => {
          const updatedAttachment = _get().attachments.find(a => a.id === attachment.id);
          if (updatedAttachment)
            return performDefaultConversionAsync(updatedAttachment);
        });
    },

    clearAttachments: () => _set({
      attachments: [],
    }),

    removeAttachment: (attachmentId: AttachmentId) =>
      _set(state => ({
        attachments: state.attachments.filter(attachment => attachment.id !== attachmentId),
      })),

    editItem: (attachmentId: AttachmentId, update: Partial<Attachment> | ((attachment: Attachment) => Partial<Attachment>)) =>
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
    // label: undefined,
    source: source,
    sourceLoading: false,
    sourceError: null,
    inputs: [],
    availableConversions: undefined,
    conversion: undefined,
    output: undefined,
    metadata: {},
  };
}


async function resolveInputAsync(source: AttachmentSource, edit: (changes: Partial<Attachment>) => void) {
  // show the loading indicator
  edit({ sourceLoading: true });

  switch (source.type) {

    // Download URL (page, file, ..) and attach as input
    case 'url':
      try {
        const page = await callBrowseFetchPage(source.url);
        if (page.content) {
          edit({
            inputs: [{
              mimeType: 'text/plain',
              data: page.content,
              // preview...
            }],
          });
        } else
          edit({ sourceError: 'No content found at this link' });
      } catch (error: any) {
        edit({ sourceError: `Issue downloading page: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}` });
      }
      break;

    // Attach file as input
    case 'file':
      try {
        const { fileWithHandle, name: fileName } = source;
        if (fileWithHandle.type === 'application/pdf') {
          const pdfText = await pdfToText(fileWithHandle);
          edit({
            inputs: [{
              mimeType: 'text/plain',
              data: pdfText,
              // preview...
            }],
          });
        } else {
          const fileText = await fileWithHandle.text();
          edit({
            inputs: [{
              mimeType: 'text/plain',
              data: fileText,
              // preview...
            }],
          });
        }
      } catch (error: any) {
        edit({ sourceError: `Issue loading file: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}` });
      }
      break;

    case 'text':
      const inputs: Attachment['inputs'] = [];
      if (source.textHtml) {
        inputs.push({
          mimeType: 'text/html',
          data: source.textHtml,
          // preview...
        });
      }
      if (source.textPlain) {
        inputs.push({
          mimeType: 'text/plain',
          data: source.textPlain,
          // preview...
        });
      }
      if (inputs.length)
        edit({ inputs });
      break;
  }

  // done loading
  edit({ sourceLoading: false });
}


function performDefaultConversionAsync(attachment: Attachment) {
  console.log('performDefaultConversionAsync', attachment.inputs);
  // setComposeText(expandPromptTemplate(PromptTemplates.PasteFile, { fileName, fileText: urlContent }));

  return undefined;
}


