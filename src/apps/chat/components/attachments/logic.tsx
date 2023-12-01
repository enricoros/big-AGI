import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { createBase36Uid } from '~/common/util/textUtils';

import { Attachment, AttachmentConversion, AttachmentId, AttachmentInput, AttachmentSource } from './store-attachments';


export function createAttachment(source: AttachmentSource, checkDuplicates: AttachmentId[]): Attachment {
  return {
    id: createBase36Uid(checkDuplicates),
    source: source,
    label: 'Loading...',
    inputLoading: false,
    inputError: null,
    input: undefined,
    conversions: [],
    conversionIdx: null,
    outputs: undefined,
    // metadata: {},
  };
}


const plainTextFileExtensions: string[] = ['.ts', '.tsx'];


// Source -> Input
export async function attachmentLoadInputAsync(source: AttachmentSource, edit: (changes: Partial<Attachment>) => void) {
  // show the loading indicator
  edit({ inputLoading: true });

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
          edit({ inputError: 'No content found at this link' });
      } catch (error: any) {
        edit({ inputError: `Issue downloading page: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}` });
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
        edit({ inputError: `Issue loading file: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}` });
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
  await new Promise(resolve => setTimeout(resolve, 100));

  // done loading
  edit({ inputLoading: false });
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
  });
}


// Input & Conversion -> Outputs
export async function attachmentConvert(
  attachment: Attachment,
  conversionIdx: number | null,
  edit: (changes: Partial<Attachment>) => void,
) {

  // check bounds
  conversionIdx = (conversionIdx !== null && conversionIdx >= 0 && conversionIdx < attachment.conversions.length) ? conversionIdx : null;

  // clear the current outputs too
  edit({
    conversionIdx,
    outputs: undefined,
  });

  // get the conversion
  const conversion = conversionIdx !== null ? attachment.conversions[conversionIdx] : null;
  if (!conversion)
    return;


  /*
    // use the conversion
    const conversion = attachment.conversions[conversionIdx];

    const outputs: AttachmentOutput[] = [];

    switch (conversion.id) {
      case 'text':



        outputs.push({
          type: 'text',
          text: attachment.input!.data || '',
          isEjectable: true,
        })
        break;

      case 'rich-text':
        edit({
          outputs: {
            html: attachment.input?.altData || attachment.input?.data,
          },
        });
        break;

      case 'rich-text-table':
        edit({
          outputs: {
            html: attachment.input?.altData || attachment.input?.data,
          },
        });
        break;

      default:
        console.warn(`Unhandled attachment conversion ${conversion.id}`);
        break;
    }
  */

}
