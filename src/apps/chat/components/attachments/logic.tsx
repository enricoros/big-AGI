import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { createBase36Uid } from '~/common/util/textUtils';
import { htmlTableToMarkdown } from '~/common/util/htmlTableToMarkdown';

import { Attachment, AttachmentConversion, AttachmentId, AttachmentInput, AttachmentOutput, AttachmentSource } from './store-attachments';


// extensions to treat as plain text
const PLAIN_TEXT_EXTENSIONS: string[] = ['.ts', '.tsx'];


export function attachmentCreate(source: AttachmentSource, checkDuplicates: AttachmentId[]): Attachment {
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


// Source -> Input
export async function attachmentLoadInputAsync(source: Readonly<AttachmentSource>, edit: (changes: Partial<Attachment>) => void) {
  edit({ inputLoading: true });

  switch (source.media) {

    // Download URL (page, file, ..) and attach as input
    case 'url':
      edit({ label: source.refUrl });
      try {
        const page = await callBrowseFetchPage(source.url);
        if (page.content) {
          edit({
            input: {
              mimeType: 'text/plain',
              data: page.content,
              dataSize: page.content.length,
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
      edit({ label: source.refPath });

      // fix missing/wrong mimetypes
      let mimeType = source.fileWithHandle.type;
      if (!mimeType) {
        // see note on 'attachAppendDataTransfer'; this is a fallback for drag/drop missing Mimes sometimes
        console.warn('Assuming the attachment is text/plain. From:', source.origin, ', name:', source.refPath);
        mimeType = 'text/plain';
      } else {
        // possibly fix wrongly assigned mimetypes (from the extension alone)
        if (!mimeType.startsWith('text/') && PLAIN_TEXT_EXTENSIONS.some(e => source.refPath.endsWith(e)))
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

  // UX: just a hint of a loading state
  await new Promise(resolve => setTimeout(resolve, 100));

  edit({ inputLoading: false });
}


// Input data -> Conversions
export function attachmentDefineConversions(sourceType: AttachmentSource['media'], input: Readonly<AttachmentInput>, edit: (changes: Partial<Attachment>) => void) {
  // return all the possible conversions for the input
  const conversions: AttachmentConversion[] = [];

  switch (input.mimeType) {

    // plain text types
    case 'text/csv':
    case 'text/plain':

      // handle a secondary layer of HTML 'text' origins (drop, paste, clipboard-read)
      const textOriginHtml = sourceType === 'text' && input.altMimeType === 'text/html' && !!input.altData;
      const isHtmlTable = !!input.altData?.startsWith('<table');

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

    // catch-all for unsupported types
    default:
      conversions.push({ id: 'unhandled', name: `Unsupported ${input.mimeType}` });
      conversions.push({ id: 'text', name: 'As Text' });
      break;
  }

  edit({ conversions });
}


// Input & Conversion -> Outputs
export function attachmentConvert(attachment: Readonly<Attachment>, conversionIdx: number | null, edit: (changes: Partial<Attachment>) => void) {

  // set conversion index
  conversionIdx = (conversionIdx !== null && conversionIdx >= 0 && conversionIdx < attachment.conversions.length) ? conversionIdx : null;
  edit({
    conversionIdx,
    outputs: undefined,
  });

  // get conversion
  const { input } = attachment;
  const conversion = conversionIdx !== null ? attachment.conversions[conversionIdx] : null;
  if (!conversion || !input)
    return;

  // apply conversion to the input
  const outputs: AttachmentOutput[] = [];
  switch (conversion.id) {
    // text as-is
    case 'text':
      outputs.push({
        type: 'text',
        text: dataToString(input.data),
        isEjectable: true,
      });
      break;

    // html as-is
    case 'rich-text':
      outputs.push({
        type: 'text',
        text: input.altData!,
        isEjectable: true,
      });
      break;

    // html to markdown table
    case 'rich-text-table':
      let mdTable: string;
      try {
        mdTable = htmlTableToMarkdown(input.altData!);
      } catch (error) {
        // fallback to text/plain
        mdTable = dataToString(input.data);
      }
      outputs.push({
        type: 'text',
        text: mdTable,
        isEjectable: true,
      });
      break;

    case 'unhandled':
      // force the user to explicitly select 'as text' if they want to proceed
      break;
  }

  // update
  edit({ outputs });
}


function dataToString(data: string | ArrayBuffer | null | undefined): string {
  if (typeof data === 'string')
    return data;
  if (data instanceof ArrayBuffer)
    return new TextDecoder().decode(data);
  return '';
}
