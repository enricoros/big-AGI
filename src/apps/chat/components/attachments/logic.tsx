import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { createBase36Uid } from '~/common/util/textUtils';

import { Attachment, AttachmentConversion, AttachmentId, AttachmentInput, AttachmentSource } from './store-attachments';


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

const plainTextFileExtensions: string[] = ['.ts', '.tsx'];

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

      // fix missing mimetypes
      let mimeType = source.fileWithHandle.type;
      if (!mimeType) {
        // see note on 'attachAppendDataTransfer'; this is a fallback for drag/drop missing Mimes sometimes
        console.warn('Assuming the attachment is text/plain. From:', source.origin, ', name:', source.name);
        mimeType = 'text/plain';
      }
      // possibly fix wrongly assigned mimetypes (from the extension alone)
      else {
        const shallBePlainText = plainTextFileExtensions.some(ext => source.name.endsWith(ext));
        if (shallBePlainText && !mimeType.startsWith('text/'))
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

  // sleep 1 second
  await new Promise(resolve => setTimeout(resolve, 160));

  // done loading
  edit({ sourceLoading: false });
}


// Input data -> Conversions
export async function attachmentDefineConversions(
  sourceType: AttachmentSource['type'],
  input: AttachmentInput,
  edit: (changes: Partial<Attachment>) => void,
) {
  const { mimeType, data, dataSize, altMimeType, altData } = input;

  const conversions: AttachmentConversion[] = [];

  switch (mimeType) {

    // plain text types
    case 'text/csv':
    case 'text/plain':

      // handle a secondary layer of HTML 'text' origins (drop, paste, clipboard-read)
      const textOriginHtml = sourceType === 'text' && altMimeType === 'text/html' && altData;
      const isHtmlTable = !!altData && altData.startsWith('<table');

      // p1: Tables
      if (textOriginHtml && isHtmlTable) {
        conversions.push({
          id: 'rich-text-table',
          name: 'Table',
        });
      }

      // p2: Text
      conversions.push({
        id: 'text',
        name: 'Text',
      });

      // p3: Html
      if (textOriginHtml && !isHtmlTable) {
        conversions.push({
          id: 'rich-text',
          name: 'Html',
        });
      }
      break;

    default:
      console.warn(`Unhandled attachment type ${mimeType} (${dataSize} bytes): ${data.slice(0, 10)}...`);
      break;
  }

  edit({
    conversions,
    conversionIdx: conversions.length ? 0 : null,
  });
}