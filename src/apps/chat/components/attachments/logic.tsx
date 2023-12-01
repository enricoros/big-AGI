import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { createBase36Uid } from '~/common/util/textUtils';

import { Attachment, AttachmentId, AttachmentInput, AttachmentSource } from './store-attachments';


export function createAttachment(source: AttachmentSource, checkDuplicates: AttachmentId[]): Attachment {
  return {
    id: createBase36Uid(checkDuplicates),
    label: 'Loading...',
    source: source,
    sourceLoading: false,
    sourceError: null,
    input: undefined,
    conversions: [],
    conversionIdx: null,
    outputs: undefined,
    // metadata: {},
  };
}

// .source -> .label, .input, .sourceError, .sourceLoading,
export async function attachmentResolveInputAsync(source: AttachmentSource, edit: (changes: Partial<Attachment>) => void) {
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
      let mimeType = source.fileWithHandle.type;
      if (!mimeType) {
        // see note on 'attachAppendDataTransfer'; this is a fallback for drag/drop missing Mimes sometimes
        console.warn('Assuming the attachment is text/plain. From:', source.origin, ', name:', source.name);
        mimeType = 'text/plain';
      }
      try {
        const fileArrayBuffer = await source.fileWithHandle.arrayBuffer();
        edit({
          input: {
            mimeType,
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
          label: 'Rich Text',
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


// Input data -> Conversions
export function attachmentDefineConversions(input: AttachmentInput, edit: (changes: Partial<Attachment>) => void) {

  switch (input.mimeType) {

    case 'text/plain':
      break;


    default:
      console.warn()
      console.log('defineConversions', input);
      break;
  }







  // edit({
  //
  // });

  // setComposeText(expandPromptTemplate(PromptTemplates.PasteFile, { fileName, fileText: urlContent }));

  return undefined;
}