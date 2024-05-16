import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { createBase36Uid } from '~/common/util/textUtils';
import { htmlTableToMarkdown } from '~/common/util/htmlTableToMarkdown';
import { pdfToImageDataURLs, pdfToText } from '~/common/util/pdfUtils';

import type { Attachment, AttachmentConverter, AttachmentId, AttachmentInput, AttachmentSource } from './store-attachments';
import type { ComposerOutputMultiPart } from '../composer.types';


// extensions to treat as plain text
const PLAIN_TEXT_EXTENSIONS: string[] = ['.ts', '.tsx'];

// mimetypes to treat as plain text
const PLAIN_TEXT_MIMETYPES: string[] = [
  'text/plain',
  'text/html',
  'text/markdown',
  'text/csv',
  'text/css',
  'text/javascript',
  'application/json',
];

/**
 * Creates a new Attachment object.
 */
export function attachmentCreate(source: AttachmentSource, checkDuplicates: AttachmentId[]): Attachment {
  return {
    id: createBase36Uid(checkDuplicates),
    source: source,
    label: 'Loading...',
    ref: '',
    inputLoading: false,
    inputError: null,
    input: undefined,
    converters: [],
    converterIdx: null,
    outputsConverting: false,
    outputs: [],
    // metadata: {},
  };
}

/**
 * Asynchronously loads the input for an Attachment object.
 *
 * @param {Readonly<AttachmentSource>} source - The source of the attachment.
 * @param {(changes: Partial<Attachment>) => void} edit - A function to edit the Attachment object.
 */
export async function attachmentLoadInputAsync(source: Readonly<AttachmentSource>, edit: (changes: Partial<Attachment>) => void) {
  edit({ inputLoading: true });

  switch (source.media) {

    // Download URL (page, file, ..) and attach as input
    case 'url':
      edit({ label: source.refUrl, ref: source.refUrl });
      try {
        const page = await callBrowseFetchPage(source.url);
        edit(
          page.content.markdown ? { input: { mimeType: 'text/markdown', data: page.content.markdown, dataSize: page.content.markdown.length } }
            : page.content.text ? { input: { mimeType: 'text/plain', data: page.content.text, dataSize: page.content.text.length } }
              : page.content.html ? { input: { mimeType: 'text/html', data: page.content.html, dataSize: page.content.html.length } }
                : { inputError: 'No content found at this link' },
        );
      } catch (error: any) {
        edit({ inputError: `Issue downloading page: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}` });
      }
      break;

    // Attach file as input
    case 'file':
      edit({ label: source.refPath, ref: source.refPath });

      // fix missing/wrong mimetypes
      let mimeType = source.fileWithHandle.type;
      if (!mimeType) {
        // see note on 'attachAppendDataTransfer'; this is a fallback for drag/drop missing Mimes sometimes
        console.warn('Assuming the attachment is text/plain. From:', source.origin, ', name:', source.refPath);
        mimeType = 'text/plain';
      } else {
        // possibly fix wrongly assigned mimetypes (from the extension alone)
        if (!mimeType.startsWith('text/') && PLAIN_TEXT_EXTENSIONS.some(ext => source.refPath.endsWith(ext)))
          mimeType = 'text/plain';
      }

      // UX: just a hint of a loading state
      await new Promise(resolve => setTimeout(resolve, 100));

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
          ref: '',
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
          ref: '',
          input: {
            mimeType: 'text/plain',
            data: text,
            dataSize: text.length,
          },
        });
      }
      break;

    case 'ego':
      edit({
        label: source.label,
        ref: source.blockTitle,
        input: {
          mimeType: 'ego/message',
          data: source.textPlain,
          dataSize: source.textPlain.length,
        },
      });
      break;
  }

  edit({ inputLoading: false });
}

/**
 * Defines the possible converters for an Attachment object based on its input type.
 *
 * @param {AttachmentSource['media']} sourceType - The media type of the attachment source.
 * @param {Readonly<AttachmentInput>} input - The input of the attachment.
 * @param {(changes: Partial<Attachment>) => void} edit - A function to edit the Attachment object.
 */
export function attachmentDefineConverters(sourceType: AttachmentSource['media'], input: Readonly<AttachmentInput>, edit: (changes: Partial<Attachment>) => void) {

  // return all the possible converters for the input
  const converters: AttachmentConverter[] = [];

  switch (true) {

    // plain text types
    case PLAIN_TEXT_MIMETYPES.includes(input.mimeType):
      // handle a secondary layer of HTML 'text' origins: drop, paste, and clipboard-read
      const textOriginHtml = sourceType === 'text' && input.altMimeType === 'text/html' && !!input.altData;
      const isHtmlTable = !!input.altData?.startsWith('<table');

      // p1: Tables
      if (textOriginHtml && isHtmlTable) {
        converters.push({
          id: 'rich-text-table',
          name: 'Markdown Table',
        });
      }

      // p2: Text
      converters.push({
        id: 'text',
        name: 'Text',
      });

      // p3: Html
      if (textOriginHtml) {
        converters.push({
          id: 'rich-text',
          name: 'HTML',
        });
      }
      break;

    // PDF
    case ['application/pdf', 'application/x-pdf', 'application/acrobat'].includes(input.mimeType):
      converters.push({ id: 'pdf-text', name: `PDF To Text` });
      converters.push({ id: 'pdf-images', name: `PDF To Images`, disabled: true });
      break;

    // images
    case input.mimeType.startsWith('image/'):
      converters.push({ id: 'image', name: `Image (coming soon)` });
      converters.push({ id: 'image-ocr', name: 'As Text (OCR)' });
      break;

    // EGO
    case input.mimeType === 'ego/message':
      converters.push({ id: 'ego-message-md', name: 'Message' });
      break;

    // catch-all
    default:
      converters.push({ id: 'unhandled', name: `${input.mimeType}`, unsupported: true });
      converters.push({ id: 'text', name: 'As Text' });
      break;
  }

  edit({ converters });
}

/**
 * Converts the input of an Attachment object based on the selected converter.
 *
 * @param {Readonly<Attachment>} attachment - The Attachment object to convert.
 * @param {number | null} converterIdx - The index of the selected conversion in the Attachment object's converters array.
 * @param {(changes: Partial<Attachment>) => void} edit - A function to edit the Attachment object.
 */
export async function attachmentPerformConversion(attachment: Readonly<Attachment>, converterIdx: number | null, edit: (changes: Partial<Attachment>) => void) {

  // set converter index
  converterIdx = (converterIdx !== null && converterIdx >= 0 && converterIdx < attachment.converters.length) ? converterIdx : null;
  edit({
    converterIdx: converterIdx,
    outputs: [],
  });

  // get converter
  const { ref, input } = attachment;
  const converter = converterIdx !== null ? attachment.converters[converterIdx] : null;
  if (!converter || !input)
    return;

  edit({
    outputsConverting: true,
  });

  // input datacould be a string or an ArrayBuffer
  function inputDataToString(data: string | ArrayBuffer | null | undefined): string {
    if (typeof data === 'string')
      return data;
    if (data instanceof ArrayBuffer)
      return new TextDecoder().decode(data);
    return '';
  }

  // apply converter to the input
  const outputs: ComposerOutputMultiPart = [];
  switch (converter.id) {

    // text as-is
    case 'text':
      outputs.push({
        type: 'text-block',
        text: inputDataToString(input.data),
        title: ref,
        collapsible: true,
      });
      break;

    // html as-is
    case 'rich-text':
      outputs.push({
        type: 'text-block',
        text: input.altData!,
        title: ref || '\n<!DOCTYPE html>',
        collapsible: true,
      });
      break;

    // html to markdown table
    case 'rich-text-table':
      let mdTable: string;
      try {
        mdTable = htmlTableToMarkdown(input.altData!, false);
      } catch (error) {
        // fallback to text/plain
        mdTable = inputDataToString(input.data);
      }
      outputs.push({
        type: 'text-block',
        text: mdTable,
        title: ref,
        collapsible: true,
      });
      break;

    case 'pdf-text':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for PDF text converter, got:', typeof input.data);
        break;
      }
      // duplicate the ArrayBuffer to avoid mutation
      const pdfData = new Uint8Array(input.data.slice(0));
      const pdfText = await pdfToText(pdfData);
      outputs.push({
        type: 'text-block',
        text: pdfText,
        title: ref,
        collapsible: true,
      });
      break;

    case 'pdf-images':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for PDF images converter, got:', typeof input.data);
        break;
      }
      // duplicate the ArrayBuffer to avoid mutation
      const pdfData2 = new Uint8Array(input.data.slice(0));
      try {
        const imageDataURLs = await pdfToImageDataURLs(pdfData2);
        imageDataURLs.forEach((pdfImg, index) => {
          outputs.push({
            type: 'image-part',
            base64Url: pdfImg.base64Url,
            metadata: {
              title: `Page ${index + 1}`,
              width: pdfImg.width,
              height: pdfImg.height,
            },
            collapsible: false,
          });
        });
      } catch (error) {
        console.error('Error converting PDF to images:', error);
      }
      break;

    case 'image':
      // TODO: continue here
      /*outputs.push({
        type: 'image-part',
        base64Url: `data:notImplemented.yet:)`,
        collapsible: false,
      });*/
      break;

    case 'image-ocr':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for Image OCR converter, got:', typeof input.data);
        break;
      }
      try {
        const { recognize } = await import('tesseract.js');
        const buffer = Buffer.from(input.data);
        const result = await recognize(buffer, undefined, {
          errorHandler: e => console.error(e),
          logger: (message) => {
            if (message.status === 'recognizing text')
              console.log('OCR progress:', message.progress);
          },
        });
        outputs.push({
          type: 'text-block',
          text: result.data.text,
          title: ref,
          collapsible: true,
        });
      } catch (error) {
        console.error(error);
      }
      break;

    case 'ego-message-md':
      outputs.push({
        type: 'text-block',
        text: inputDataToString(input.data),
        title: ref,
        collapsible: true,
      });
      break;

    case 'unhandled':
      // force the user to explicitly select 'as text' if they want to proceed
      break;
  }

  // update
  edit({
    outputsConverting: false,
    outputs,
  });
}