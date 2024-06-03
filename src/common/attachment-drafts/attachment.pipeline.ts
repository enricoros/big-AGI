import { callBrowseFetchPage } from '~/modules/browse/browse.client';

import { createBase64UuidV4 } from '~/common/util/textUtils';
import { htmlTableToMarkdown } from '~/common/util/htmlTableToMarkdown';
import { pdfToImageDataURLs, pdfToText } from '~/common/util/pdfUtils';

import { createTextAttachmentFragment, DMessageAttachmentFragment } from '~/common/stores/chat/chat.message';

import type { AttachmentDraft, AttachmentDraftConverter, AttachmentDraftInput, AttachmentDraftSource } from './attachment.types';
import type { AttachmentsDraftsStore } from './store-attachment-drafts-slice';
import { attachmentImageToFragmentViaDBlob } from './attachment.dblobs';


// configuration
export const DEFAULT_ADRAFT_IMAGE_MIMETYPE = 'image/webp';
export const DEFAULT_ADRAFT_IMAGE_QUALITY = 0.98;
const PDF_IMAGE_PAGE_SCALE = 1.5;
const PDF_IMAGE_QUALITY = 0.5;


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
  // https://ai.google.dev/gemini-api/docs/prompting_with_media?lang=node#plain_text_formats
  'application/rtf',
  'application/x-javascript',
  'application/x-python-code',
  'application/x-typescript',
  'text/rtf',
  'text/x-python',
  'text/x-typescript',
  'text/xml',
];

// Image Rules across the supported LLMs
//
// OpenAI: https://platform.openai.com/docs/guides/vision/what-type-of-files-can-i-upload
//  - Supported Image formats:
//    - Images are first scaled to fit within a 2048 x 2048 square (if larger), maintaining their aspect ratio.
//      Then, they are scaled down such that the shortest side of the image is 768px (if larger)
//    - PNG (.png), JPEG (.jpeg and .jpg), WEBP (.webp), and non-animated GIF (.gif)
//
// Google: https://ai.google.dev/gemini-api/docs/prompting_with_media
//  - Supported Image formats:
//    - models: gemini-1.5-pro, gemini-pro-vision
//    - PNG - image/png, JPEG - image/jpeg, WEBP - image/webp, HEIC - image/heic, HEIF - image/heif
//    - [strat] for prompts containing a single image, it might perform better if that image is placed before the text prompt
//    - Maximum of 16 individual images for the gemini-pro-vision and 3600 images for gemini-1.5-pro
//    - No specific limits to the number of pixels in an image; however, larger images are scaled down to
//    - fit a maximum resolution of 3072 x 3072 while preserving their original aspect ratio
//
//  - Supported Audio formats:
//    - models: gemini-1.5-pro
//    - WAV - audio/wav, MP3 - audio/mp3, AIFF - audio/aiff, AAC - audio/aac, OGG Vorbis - audio/ogg, FLAC - audio/flac
//    - The maximum supported length of audio data in a single prompt is 9.5 hours
//    - Audio files are resampled down to a 16 Kbps data resolution, and multiple channels of audio are combined into a single channel
//    - No limit of audio files in a single prompt (but < 9.5Hrs)
//
//  - Supported Video formats:
//    - models: gemini-1.5-pro
//    - video/mp4 video/mpeg, video/mov, video/avi, video/x-flv, video/mpg, video/webm, video/wmv, video/3gpp
//    - The File API service samples videos into images at 1 frame per second (FPS) and may be subject to change to provide the best
//      inference quality. Individual images take up 258 tokens regardless of resolution and quality
//
// Anthropic: https://docs.anthropic.com/en/docs/vision
//  - Supported Image formats:
//    - image/jpeg, image/png, image/gif, and image/webp
//    - If image’s long edge is more than 1568 pixels, or your image is more than ~1600 tokens, it will first be scaled down
//      - Max Image Size per Aspect ratio: 1:1 1092x1092 px, 3:4 951x1268 px, 2:3 896x1344 px, 9:16 819x1456 px, 1:2 784x1568 px
//    - Max size is 5MB/image on the API
//    - Up to 20 images in a single request (note, request, not message)

// Least common denominator of the types above
const IMAGE_MIMETYPES: string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];


/**
 * Creates a new AttachmentDraft object.
 */
export function attachmentCreate(source: AttachmentDraftSource): AttachmentDraft {
  return {
    id: createBase64UuidV4(),
    source: source,
    label: 'Loading...',
    ref: '',
    inputLoading: false,
    inputError: null,
    input: undefined,
    converters: [],
    converterIdx: null,
    outputsConverting: false,
    outputFragments: [],
    // metadata: {},
  };
}

/**
 * Asynchronously loads the input for an AttachmentDraft object.
 *
 * @param {Readonly<AttachmentDraftSource>} source - The source of the attachment.
 * @param {(changes: Partial<AttachmentDraft>) => void} edit - A function to edit the AttachmentDraft object.
 */
export async function attachmentLoadInputAsync(source: Readonly<AttachmentDraftSource>, edit: (changes: Partial<Omit<AttachmentDraft, 'outputFragments'>>) => void) {
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
 * Defines the possible converters for an AttachmentDraft object based on its input type.
 *
 * @param {AttachmentDraftSource['media']} sourceType - The media type of the attachment source.
 * @param {Readonly<AttachmentDraftInput>} input - The input of the AttachmentDraft object.
 * @param {(changes: Partial<AttachmentDraft>) => void} edit - A function to edit the AttachmentDraft object.
 */
export function attachmentDefineConverters(sourceType: AttachmentDraftSource['media'], input: Readonly<AttachmentDraftInput>, edit: (changes: Partial<Omit<AttachmentDraft, 'outputFragments'>>) => void) {

  // return all the possible converters for the input
  const converters: AttachmentDraftConverter[] = [];

  switch (true) {

    // plain text types
    case PLAIN_TEXT_MIMETYPES.includes(input.mimeType):
      // handle a secondary layer of HTML 'text' origins: drop, paste, and clipboard-read
      const textOriginHtml = sourceType === 'text' && input.altMimeType === 'text/html' && !!input.altData;
      const isHtmlTable = !!input.altData?.startsWith('<table');

      // p1: Tables
      if (textOriginHtml && isHtmlTable)
        converters.push({ id: 'rich-text-table', name: 'Markdown Table' });

      // p2: Text
      converters.push({ id: 'text', name: 'Text' });

      // p3: Html
      if (textOriginHtml)
        converters.push({ id: 'rich-text', name: 'HTML' });
      break;

    // Images (Known/Unknown)
    case input.mimeType.startsWith('image/'):
      const imageSupported = IMAGE_MIMETYPES.includes(input.mimeType);
      converters.push({ id: 'image-resized-high', name: 'Image (high detail)', disabled: !imageSupported });
      converters.push({ id: 'image-resized-low', name: 'Image (low detail)', disabled: !imageSupported });
      converters.push({ id: 'image-original', name: 'Image (original quality)', disabled: !imageSupported });
      if (!imageSupported)
        converters.push({ id: 'image-to-default', name: `As Image (${DEFAULT_ADRAFT_IMAGE_MIMETYPE})` });
      converters.push({ id: 'image-ocr', name: 'As Text (OCR)' });
      break;

    // PDF
    case ['application/pdf', 'application/x-pdf', 'application/acrobat'].includes(input.mimeType):
      converters.push({ id: 'pdf-text', name: 'PDF To Text (OCR)' });
      converters.push({ id: 'pdf-images', name: 'PDF To Images' });
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
 * Converts the input of an AttachmentDraft object based on the selected converter.
 *
 * @param {Readonly<AttachmentDraft>} attachment - The AttachmentDraft object to convert.
 * @param {number | null} converterIdx - The index of the selected converter.
 * @param edit - A function to edit the AttachmentDraft object.
 * @param replaceOutputFragments - A function to replace the output fragments of the AttachmentDraft object.
 */
export async function attachmentPerformConversion(
  attachment: Readonly<AttachmentDraft>,
  converterIdx: number | null,
  edit: AttachmentsDraftsStore['_editAttachment'],
  replaceOutputFragments: AttachmentsDraftsStore['_replaceAttachmentOutputFragments'],
) {

  // set converter index
  converterIdx = (converterIdx !== null && converterIdx >= 0 && converterIdx < attachment.converters.length) ? converterIdx : null;
  edit(attachment.id, {
    converterIdx: converterIdx,
  });
  replaceOutputFragments(attachment.id, []);

  // get converter
  const { source, ref, input } = attachment;
  const converter = converterIdx !== null ? attachment.converters[converterIdx] : null;
  if (!converter || !input)
    return;

  edit(attachment.id, {
    outputsConverting: true,
  });


  // apply converter to the input
  const newFragments: DMessageAttachmentFragment[] = [];
  switch (converter.id) {

    // text as-is
    case 'text':
      newFragments.push(createTextAttachmentFragment(inputDataToString(input.data), ref));
      break;

    // html as-is
    case 'rich-text':
      newFragments.push(createTextAttachmentFragment(input.altData!, ref || '\n<!DOCTYPE html>'));
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
      newFragments.push(createTextAttachmentFragment(mdTable, ref));
      break;

    // image resized (default mime/quality, openai-high-res)
    case 'image-resized-high':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for image-resized, got:', typeof input.data);
        return null;
      }
      const imageHighF = await attachmentImageToFragmentViaDBlob(input.mimeType, input.data, source, ref, ref, false, 'openai-high-res');
      if (imageHighF)
        newFragments.push(imageHighF);
      break;

    // image resized (default mime/quality, openai-low-res)
    case 'image-resized-low':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for image-resized, got:', typeof input.data);
        return null;
      }
      const imageLowF = await attachmentImageToFragmentViaDBlob(input.mimeType, input.data, source, ref, ref, false, 'openai-low-res');
      if (imageLowF)
        newFragments.push(imageLowF);
      break;

    // image as-is
    case 'image-original':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for image-original, got:', typeof input.data);
        return null;
      }
      const imageOrigF = await attachmentImageToFragmentViaDBlob(input.mimeType, input.data, source, ref, ref, false, false);
      if (imageOrigF)
        newFragments.push(imageOrigF);
      break;

    // image converted (potentially unsupported mime)
    case 'image-to-default':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for image-to-default, got:', typeof input.data);
        return null;
      }
      const imageCastF = await attachmentImageToFragmentViaDBlob(input.mimeType, input.data, source, ref, ref, DEFAULT_ADRAFT_IMAGE_MIMETYPE, false);
      if (imageCastF)
        newFragments.push(imageCastF);
      break;

    // image to text
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
        const imageText = result.data.text;
        newFragments.push(createTextAttachmentFragment(imageText, ref));
      } catch (error) {
        console.error(error);
      }
      break;


    // pdf to text
    case 'pdf-text':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for PDF text converter, got:', typeof input.data);
        break;
      }
      // duplicate the ArrayBuffer to avoid mutation
      const pdfData = new Uint8Array(input.data.slice(0));
      const pdfText = await pdfToText(pdfData);
      newFragments.push(createTextAttachmentFragment(pdfText, ref));
      break;

    // pdf to images
    case 'pdf-images':
      if (!(input.data instanceof ArrayBuffer)) {
        console.log('Expected ArrayBuffer for PDF images converter, got:', typeof input.data);
        break;
      }
      // duplicate the ArrayBuffer to avoid mutation
      const pdfData2 = new Uint8Array(input.data.slice(0));
      try {
        const imageDataURLs = await pdfToImageDataURLs(pdfData2, DEFAULT_ADRAFT_IMAGE_MIMETYPE, PDF_IMAGE_QUALITY, PDF_IMAGE_PAGE_SCALE);
        for (const pdfPageImage of imageDataURLs) {
          const pdfPageImageF = await attachmentImageToFragmentViaDBlob(pdfPageImage.mimeType, pdfPageImage.base64Data, source, `Page ${newFragments.length + 1}`, ref, false, false);
          if (pdfPageImageF)
            newFragments.push(pdfPageImageF);
        }
      } catch (error) {
        console.error('Error converting PDF to images:', error);
      }
      break;


    // self: message
    case 'ego-message-md':
      newFragments.push(createTextAttachmentFragment(inputDataToString(input.data), ref));
      break;

    case 'unhandled':
      // force the user to explicitly select 'as text' if they want to proceed
      break;
  }

  // update
  replaceOutputFragments(attachment.id, newFragments);
  edit(attachment.id, {
    outputsConverting: false,
  });
}


function inputDataToString(data: string | ArrayBuffer | null | undefined): string {
  if (typeof data === 'string')
    return data;
  if (data instanceof ArrayBuffer)
    return new TextDecoder().decode(data);
  return '';
}
