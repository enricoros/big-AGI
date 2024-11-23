import type { FileWithHandle } from 'browser-fs-access';

import { callBrowseFetchPage } from '~/modules/browse/browse.client';
import { extractYoutubeVideoIDFromURL } from '~/modules/youtube/youtube.utils';
import { youTubeGetVideoData } from '~/modules/youtube/useYouTubeTranscript';

import { Is } from '~/common/util/pwaUtils';
import { agiCustomId, agiUuid } from '~/common/util/idUtils';
import { htmlTableToMarkdown } from '~/common/util/htmlTableToMarkdown';
import { humanReadableHyphenated } from '~/common/util/textUtils';
import { pdfToImageDataURLs, pdfToText } from '~/common/util/pdfUtils';

import { createDMessageDataInlineText, createDocAttachmentFragment, DMessageAttachmentFragment, DMessageDataInline, DMessageDocPart, DVMimeType, isContentOrAttachmentFragment, isDocPart, specialContentPartToDocAttachmentFragment } from '~/common/stores/chat/chat.fragments';

import type { AttachmentCreationOptions, AttachmentDraft, AttachmentDraftConverter, AttachmentDraftId, AttachmentDraftInput, AttachmentDraftSource, AttachmentDraftSourceOriginFile, DraftEgoFragmentsInputData, DraftWebInputData, DraftYouTubeInputData } from './attachment.types';
import type { AttachmentsDraftsStore } from './store-perchat-attachment-drafts_slice';
import { attachmentGetLiveFileId, attachmentSourceSupportsLiveFile } from './attachment.livefile';
import { guessInputContentTypeFromMime, heuristicMimeTypeFixup, mimeTypeIsDocX, mimeTypeIsPDF, mimeTypeIsPlainText, mimeTypeIsSupportedImage, reverseLookupMimeType } from './attachment.mimetypes';
import { imageDataToImageAttachmentFragmentViaDBlob } from './attachment.dblobs';


// configuration
export const DEFAULT_ADRAFT_IMAGE_MIMETYPE = !Is.Browser.Safari ? 'image/webp' : 'image/jpeg';
export const DEFAULT_ADRAFT_IMAGE_QUALITY = 0.96;
const PDF_IMAGE_PAGE_SCALE = 1.5;
const PDF_IMAGE_QUALITY = 0.5;
const ENABLE_TEXT_AND_IMAGES = false; // 2.0
const DOCPART_DEFAULT_VERSION = 1;


// internal mimes, only used to route data within us (source -> input -> converters)
const INT_MIME_VND_AGI_EGO_FRAGMENTS = 'application/vnd.agi.ego.fragments';
const INT_MIME_VND_AGI_WEBPAGE = 'application/vnd.agi.webpage';
const INT_MIME_VND_AGI_YOUTUBE = 'application/vnd.agi.youtube';


/**
 * Creates a new AttachmentDraft object.
 */
export function attachmentCreate(source: AttachmentDraftSource): AttachmentDraft {
  return {
    id: agiUuid('attachment-draft'),
    source: source,
    label: 'Loading...',
    ref: '',
    inputLoading: false,
    inputError: null,
    input: undefined,
    converters: [],
    outputsConverting: false,
    outputsConversionProgress: null,
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

      // [YouTube] user is attaching a link to a video: try to download this as a transcript rather than a webpage
      const asYoutubeVideoId = extractYoutubeVideoIDFromURL(source.refUrl);
      if (asYoutubeVideoId) {
        const videoData = await youTubeGetVideoData(asYoutubeVideoId).catch(() => null);
        if (videoData?.videoTitle && videoData?.transcript) {
          edit({
            label: videoData.videoTitle,
            input: {
              mimeType: INT_MIME_VND_AGI_YOUTUBE,
              data: {
                videoId: asYoutubeVideoId,
                videoTitle: videoData.videoTitle,
                videoDescription: videoData.videoDescription,
                videoThumbnailUrl: videoData.thumbnailUrl,
                videoTranscript: videoData.transcript,
              },
              urlImage: !videoData.thumbnailImage ? undefined : {
                ...videoData.thumbnailImage,
                generator: 'youtube-thumbnail',
                timestamp: Date.now(),
              },
            },
          });
          break;
        }
      }

      try {
        // fetch the web page
        const { title, content: { html, markdown, text }, screenshot } = await callBrowseFetchPage(
          source.url, ['text', 'markdown', 'html'], { width: 512, height: 512, quality: 98 },
        );
        if (html || markdown || text)
          edit({
            label: title || source.refUrl,
            input: {
              mimeType: INT_MIME_VND_AGI_WEBPAGE,
              data: {
                pageText: text ?? undefined,
                pageMarkdown: markdown ?? undefined,
                pageCleanedHtml: html ?? undefined,
                pageTitle: title || undefined,
              },
              urlImage: !screenshot ? undefined : {
                ...screenshot,
                generator: 'web-capture',
                timestamp: Date.now(),
              },
            },
          });
        else
          edit({ inputError: 'No content found at this link' });
      } catch (error: any) {
        edit({ inputError: `Issue downloading page: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}` });
      }
      break;

    // Attach file as input
    case 'file':
      edit({ label: source.refPath, ref: source.refPath });

      // fix missing/wrong mimetypes
      let fileMime: string | null = source.fileWithHandle.type;
      const fileExtension = source.refPath.split('.').pop()?.toLowerCase() || undefined;
      if (!fileMime) {
        // see note on 'attachAppendDataTransfer'; this is a fallback for drag/drop missing Mimes sometimes
        if (fileExtension)
          fileMime = reverseLookupMimeType(fileExtension);

        // unknown extension or missing extension and mime: falling back to text/plain
        if (!fileMime) {
          console.warn(`Assuming the attachment is text/plain. From: '${source.origin}', name: ${source.refPath}`);
          fileMime = 'text/plain';
        }
      } else {
        // WEAK - Fix wrongly assigned mimetypes - this is a hardcoded hack basically - please remove.
        fileMime = heuristicMimeTypeFixup(fileMime, fileExtension);
      }

      // UX: just a hint of a loading state
      // Note: disabled: the read operation will be async anyway, and
      //       we don't want to delay too long in case of large drops.
      // await new Promise(resolve => setTimeout(resolve, 50));

      try {
        const fileArrayBuffer = await source.fileWithHandle.arrayBuffer();
        edit({
          input: {
            mimeType: fileMime,
            data: fileArrayBuffer,
            dataSize: fileArrayBuffer.byteLength,
          },
        });
      } catch (error: any) {
        const errorText = (error?.name === 'AbortError' && source.fileWithHandle.type === '')
          ? 'unsupported file type or possible folder. For folders and LiveFile support, we recommend using Google Chrome.'
          : `issue loading file: ${error?.message || (typeof error === 'string' ? error : JSON.stringify(error))}`;
        edit({ inputError: errorText });
      }
      break;

    case 'text':
      // Obsidian URLs, for dragging: we won't be able to open them, so we'll show the input error instead
      if (source.textPlain?.startsWith('obsidian://open?vault=')) {
        edit({ label: 'Obsidian Issue', inputError: 'Drag and drop does not work with Obsidian URLs. Please open/attach the file, or drag it from finder/explorer, or paste the content.' });
        break;
      }

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
        ref: `${source.egoFragmentsInputData.messageId} - ${source.egoFragmentsInputData.conversationTitle}`,
        input: {
          mimeType: INT_MIME_VND_AGI_EGO_FRAGMENTS,
          data: source.egoFragmentsInputData,
        },
      });
      break;
  }

  edit({ inputLoading: false });
}


/**
 * Defines the possible converters for an AttachmentDraft object based on its input type.
 *
 * @param {Readonly<AttachmentDraftSource>} source - The source of the AttachmentDraft object.
 * @param {Readonly<AttachmentDraftInput>} input - The input of the AttachmentDraft object.
 * @param options conversion preferences, if any
 * @param {(changes: Partial<AttachmentDraft>) => void} edit - A function to edit the AttachmentDraft object.
 */
export function attachmentDefineConverters(source: AttachmentDraftSource, input: Readonly<AttachmentDraftInput>, options: AttachmentCreationOptions, edit: (changes: Partial<Omit<AttachmentDraft, 'outputFragments'>>) => void) {

  // return all the possible converters for the input
  const converters: AttachmentDraftConverter[] = [];

  const autoAddImages = ENABLE_TEXT_AND_IMAGES && !!options?.hintAddImages;

  switch (true) {

    // plain text types
    case mimeTypeIsPlainText(input.mimeType):
      // handle a secondary layer of HTML 'text' origins: drop, paste, and clipboard-read
      const textOriginHtml = source.media === 'text' && input.altMimeType === 'text/html' && !!input.altData;
      const isHtmlTable = !!input.altData?.startsWith('<table');

      // p1: Tables
      if (textOriginHtml && isHtmlTable)
        converters.push({ id: 'rich-text-table', name: 'Markdown Table' });

      // p2: Text
      converters.push({ id: 'text', name: attachmentSourceSupportsLiveFile(source) ? 'Text (Live)' : 'Text' });

      // p3: Html
      if (textOriginHtml) {
        converters.push({ id: 'rich-text', name: 'HTML' });
        converters.push({ id: 'rich-text-cleaner', name: 'Clean HTML' });
      }
      break;

    // Images (Known/Unknown)
    case input.mimeType.startsWith('image/'):
      const inputImageMimeSupported = mimeTypeIsSupportedImage(input.mimeType);
      converters.push({ id: 'image-resized-high', name: 'Image (high detail)', disabled: !inputImageMimeSupported });
      converters.push({ id: 'image-resized-low', name: 'Image (low detail)', disabled: !inputImageMimeSupported });
      converters.push({ id: 'image-original', name: 'Image (original quality)', disabled: !inputImageMimeSupported });
      if (!inputImageMimeSupported)
        converters.push({ id: 'image-to-default', name: `As Image (${DEFAULT_ADRAFT_IMAGE_MIMETYPE})` });
      converters.push({ id: 'image-ocr', name: 'As Text (OCR)' });
      break;

    // PDF
    case mimeTypeIsPDF(input.mimeType):
      converters.push({ id: 'pdf-text', name: 'PDF To Text', isActive: !autoAddImages || undefined });
      converters.push({ id: 'pdf-images', name: 'PDF To Images' });
      converters.push({ id: 'pdf-text-and-images', name: 'PDF Text & Images (best)', isActive: autoAddImages });
      break;

    // DOCX
    case mimeTypeIsDocX(input.mimeType):
      converters.push({ id: 'docx-to-html', name: 'DOCX to HTML' });
      break;

    // URL: custom converters because of a custom input structure with multiple inputs
    case input.mimeType === INT_MIME_VND_AGI_WEBPAGE:
      const pageData = input.data as DraftWebInputData;
      const preferMarkdown = !!pageData.pageMarkdown;
      if (pageData.pageText)
        converters.push({ id: 'url-page-text', name: 'Text', isActive: !preferMarkdown });
      if (pageData.pageMarkdown)
        converters.push({ id: 'url-page-markdown', name: 'Markdown (suggested)', isActive: preferMarkdown });
      if (pageData.pageCleanedHtml)
        converters.push({ id: 'url-page-html', name: 'Clean HTML', isActive: !preferMarkdown && !pageData.pageText });
      if (input.urlImage) {
        if (converters.length)
          converters.push({ id: 'url-page-null', name: 'Do not attach' });
        converters.push({ id: 'url-page-image', name: 'Add Screenshot', disabled: !input.urlImage.width || !input.urlImage.height, isCheckbox: true, isActive: autoAddImages || undefined });
      }
      break;

    // YouTube: custom converters
    case input.mimeType === INT_MIME_VND_AGI_YOUTUBE:
      converters.push({ id: 'youtube-transcript', name: 'Video Transcript', isActive: true });
      converters.push({ id: 'youtube-transcript-simple', name: 'Video Transcript (simple)' });
      if (input.urlImage)
        converters.push({ id: 'url-page-image', name: 'Add Thumbnail', disabled: !input.urlImage.width || !input.urlImage.height, isCheckbox: true, isActive: autoAddImages });
      break;

    // EGO
    case input.mimeType === INT_MIME_VND_AGI_EGO_FRAGMENTS:
      converters.push({ id: 'ego-fragments-inlined', name: 'Message' });
      break;

    // catch-all
    default:
      converters.push({ id: 'unhandled', name: `${input.mimeType}`, unsupported: true });
      converters.push({ id: 'text', name: 'As Text' });
      break;
  }

  edit({ converters });
}


function _lowCollisionRefString(prefix: string, digits: number): string {
  return `${prefix} ${agiCustomId(digits)}`;
}

function _prepareDocData(source: AttachmentDraftSource, input: Readonly<AttachmentDraftInput>, converterName: string): {
  title: string;
  caption: string;
  refString: string;
  docMeta?: DMessageDocPart['meta'];
} {
  const inputMime = input.mimeType || '';
  switch (source.media) {

    // Downloaded URL as Text, Markdown, or HTML
    case 'url':
      let pageTitle =
        inputMime === INT_MIME_VND_AGI_WEBPAGE ? (input.data as DraftWebInputData)?.pageTitle
          : inputMime === INT_MIME_VND_AGI_YOUTUBE ? (input.data as DraftYouTubeInputData)?.videoTitle
            : undefined;
      if (!pageTitle)
        pageTitle = `Web page: ${source.refUrl}`;
      const urlRefString = inputMime === INT_MIME_VND_AGI_YOUTUBE ? 'youtube-' + (input.data as DraftYouTubeInputData)?.videoId : pageTitle;
      return {
        title: pageTitle,
        caption: converterName,
        refString: humanReadableHyphenated(urlRefString),
      };

    // File of various kinds and coming from various sources
    case 'file':
      const mayBeImage = inputMime.startsWith('image/');

      let fileTitle = _lowCollisionRefString(mayBeImage ? 'Image' : 'File', 4);
      let fileCaption = '';
      const fileMeta: DMessageDocPart['meta'] = {
        srcFileName: source.fileWithHandle.name || undefined,
        srcFileSize: source.fileWithHandle.size || input.dataSize,
      };

      switch (source.origin) {
        case 'camera':
          fileTitle = source.refPath || _lowCollisionRefString('Camera Photo', 6);
          break;
        case 'screencapture':
          fileTitle = source.refPath || _lowCollisionRefString('Screen Capture', 6);
          fileCaption = 'Screen Capture';
          break;
        case 'file-open':
          fileTitle = source.refPath || _lowCollisionRefString('Uploaded File', 6);
          break;
        case 'clipboard-read':
        case 'paste':
          fileTitle = source.refPath || _lowCollisionRefString('Pasted File', 6);
          break;
        case 'drop':
          fileTitle = source.refPath || _lowCollisionRefString('Dropped File', 6);
          break;
      }
      return {
        title: fileTitle,
        caption: fileCaption,
        refString: humanReadableHyphenated(fileTitle),
        docMeta: fileMeta,
      };

    // Text from clipboard, drop, or paste
    case 'text':
      const textRef = _lowCollisionRefString('doc', 6);
      return {
        title: converterName || 'Text',
        caption: source.method === 'drop' ? 'Dropped' : 'Pasted',
        refString: humanReadableHyphenated(textRef),
      };

    // The application attaching pieces of itself
    case 'ego':
      const egoKind = source.method === 'ego-fragments' ? 'Chat Message' : '';
      return {
        title: egoKind,
        caption: 'From Chat: ' + source.egoFragmentsInputData.conversationTitle,
        refString: humanReadableHyphenated(egoKind),
      };
  }
}

function _guessDocVDT(inputMimeType: string): DMessageDocPart['vdt'] {
  if (!inputMimeType)
    return DVMimeType.TextPlain;
  const inputContentType = guessInputContentTypeFromMime(inputMimeType);
  switch (inputContentType) {
    case 'plain':
    case 'markdown':
      return DVMimeType.TextPlain;

    case 'html':
    case 'code':
      return DVMimeType.VndAgiCode;

    // these would have been converted - let's assume to code, but we don't return here as this code path won't happen
    // case 'doc-pdf': // plain or OCR, or images
    // case 'doc-msw': // code (html), or images
    // case 'doc-msxl': // code (html), or images
    // case 'doc-msppt': // code (html), or images
    // case 'image': // images won't get in docs
    // case 'audio': // same for audio
    // case 'video': // and video
    // case 'other': // and this even less
  }
  return DVMimeType.TextPlain;
}


/**
 * Converts the input of an AttachmentDraft object based on the selected converter.
 *
 * @param {Readonly<AttachmentDraft>} attachment - The AttachmentDraft object to convert.
 * @param edit - A function to edit the AttachmentDraft object.
 * @param replaceOutputFragments - A function to replace the output fragments of the AttachmentDraft object.
 */
export async function attachmentPerformConversion(
  attachment: Readonly<AttachmentDraft>,
  edit: (attachmentDraftId: AttachmentDraftId, update: Partial<Omit<AttachmentDraft, 'outputFragments'>>) => void, /* AttachmentsDraftsStore['_editAttachment'] */
  replaceOutputFragments: AttachmentsDraftsStore['_replaceAttachmentOutputFragments'],
) {

  // clear outputs
  // NOTE: disabled, to keep the old conversions while converting to the new - keeps the UI less 'flashing'
  // replaceOutputFragments(attachment.id, []);

  // get converter
  const { input, source } = attachment;
  if (!input)
    return;

  edit(attachment.id, {
    outputsConverting: true,
    outputsConversionProgress: null,
  });

  // apply converter to the input
  const newFragments: DMessageAttachmentFragment[] = [];
  for (const converter of attachment.converters) {
    if (!converter.isActive) continue;

    // prepare the doc data
    let { title, caption, refString, docMeta } = _prepareDocData(source, input, converter.name);

    switch (converter.id) {

      // text as-is
      case 'text':
        const possibleLiveFileId = await attachmentGetLiveFileId(source);
        const textualInlineData = createDMessageDataInlineText(_inputDataToString(input.data), input.mimeType);
        newFragments.push(createDocAttachmentFragment(title, caption, _guessDocVDT(input.mimeType), textualInlineData, refString, DOCPART_DEFAULT_VERSION, docMeta, possibleLiveFileId));
        break;

      // html as-is
      case 'rich-text':
        // NOTE: before we had the following: createTextAttachmentFragment(ref || '\n<!DOCTYPE html>', input.altData!), which
        //       was used to wrap the HTML in a code block to facilitate AutoRenderBlocks's parser. Historic note, for future debugging.
        const richTextData = createDMessageDataInlineText(input.altData || '', input.altMimeType);
        newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.VndAgiCode, richTextData, refString, DOCPART_DEFAULT_VERSION, docMeta));
        break;

      // html cleaned
      case 'rich-text-cleaner':
        const cleanerHtml = (input.altData || '')
          // remove class and style attributes
          .replace(/<[^>]+>/g, (tag) =>
            tag.replace(/ class="[^"]*"/g, '').replace(/ style="[^"]*"/g, ''),
          )
          // remove svg elements
          .replace(/<svg[^>]*>.*?<\/svg>/g, '');
        const cleanedHtmlData = createDMessageDataInlineText(cleanerHtml, 'text/html');
        newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.VndAgiCode, cleanedHtmlData, refString, DOCPART_DEFAULT_VERSION, docMeta));
        break;

      // html to markdown table
      case 'rich-text-table':
        let tableData: DMessageDataInline;
        try {
          const mdTable = htmlTableToMarkdown(input.altData!, false);
          tableData = createDMessageDataInlineText(mdTable, 'text/markdown');
        } catch (error) {
          // fallback to text/plain
          tableData = createDMessageDataInlineText(_inputDataToString(input.data), input.mimeType);
        }
        newFragments.push(createDocAttachmentFragment(title, caption, tableData.mimeType === 'text/markdown' ? DVMimeType.TextPlain : DVMimeType.TextPlain, tableData, refString, DOCPART_DEFAULT_VERSION, docMeta));
        break;


      // image resized (default mime/quality, openai-high-res)
      case 'image-resized-high':
        if (!(input.data instanceof ArrayBuffer)) {
          console.log('Expected ArrayBuffer for image-resized, got:', typeof input.data);
          return null;
        }
        const imageHighF = await imageDataToImageAttachmentFragmentViaDBlob(input.mimeType, input.data, source, title, caption, false, 'openai-high-res');
        if (imageHighF)
          newFragments.push(imageHighF);
        break;

      // image resized (default mime/quality, openai-low-res)
      case 'image-resized-low':
        if (!(input.data instanceof ArrayBuffer)) {
          console.log('Expected ArrayBuffer for image-resized, got:', typeof input.data);
          return null;
        }
        const imageLowF = await imageDataToImageAttachmentFragmentViaDBlob(input.mimeType, input.data, source, title, caption, false, 'openai-low-res');
        if (imageLowF)
          newFragments.push(imageLowF);
        break;

      // image as-is
      case 'image-original':
        if (!(input.data instanceof ArrayBuffer)) {
          console.log('Expected ArrayBuffer for image-original, got:', typeof input.data);
          return null;
        }
        const imageOrigF = await imageDataToImageAttachmentFragmentViaDBlob(input.mimeType, input.data, source, title, caption, false, false);
        if (imageOrigF)
          newFragments.push(imageOrigF);
        break;

      // image converted (potentially unsupported mime)
      case 'image-to-default':
        if (!(input.data instanceof ArrayBuffer)) {
          console.log('Expected ArrayBuffer for image-to-default, got:', typeof input.data);
          return null;
        }
        const imageCastF = await imageDataToImageAttachmentFragmentViaDBlob(input.mimeType, input.data, source, title, caption, DEFAULT_ADRAFT_IMAGE_MIMETYPE, false);
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
          let lastProgress = -1;
          const { recognize } = await import('tesseract.js');
          const buffer = Buffer.from(input.data);
          const result = await recognize(buffer, undefined, {
            errorHandler: e => console.error(e),
            logger: (message) => {
              if (message.status === 'recognizing text') {
                if (message.progress > lastProgress + 0.01) {
                  lastProgress = message.progress;
                  edit(attachment.id, { outputsConversionProgress: lastProgress });
                }
              }
            },
          });
          const imageText = result.data.text;
          newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.TextPlain, createDMessageDataInlineText(imageText, 'text/plain'), refString, DOCPART_DEFAULT_VERSION, { ...docMeta, srcOcrFrom: 'image' }));
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
        const pdfData = new Uint8Array(input.data.slice(0)).buffer;
        const pdfText = await pdfToText(pdfData, (progress: number) => {
          edit(attachment.id, { outputsConversionProgress: progress });
        });
        if (pdfText.trim().length < 2) {
          // Warn the user if no text is extracted
          // edit(attachment.id, { inputError: 'No text found in the PDF file.' });
        } else
          newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.TextPlain, createDMessageDataInlineText(pdfText, 'text/plain'), refString, DOCPART_DEFAULT_VERSION, { ...docMeta, srcOcrFrom: 'pdf' }));
        break;

      // pdf to images
      case 'pdf-images':
        if (!(input.data instanceof ArrayBuffer)) {
          console.log('Expected ArrayBuffer for PDF images converter, got:', typeof input.data);
          break;
        }
        // duplicate the ArrayBuffer to avoid mutation
        const pdfData2 = new Uint8Array(input.data.slice(0)).buffer;
        try {
          const imageDataURLs = await pdfToImageDataURLs(pdfData2, DEFAULT_ADRAFT_IMAGE_MIMETYPE, PDF_IMAGE_QUALITY, PDF_IMAGE_PAGE_SCALE, (progress) => {
            edit(attachment.id, { outputsConversionProgress: progress });
          });
          for (const pdfPageImage of imageDataURLs) {
            const pdfPageImageF = await imageDataToImageAttachmentFragmentViaDBlob(pdfPageImage.mimeType, pdfPageImage.base64Data, source, `${title} (pg. ${newFragments.length + 1})`, caption, false, false);
            if (pdfPageImageF)
              newFragments.push(pdfPageImageF);
          }
        } catch (error) {
          console.error('Error converting PDF to images:', error);
        }
        break;

      // pdf to text and images
      case 'pdf-text-and-images':
        if (!(input.data instanceof ArrayBuffer)) {
          console.log('Expected ArrayBuffer for PDF text and images converter, got:', typeof input.data);
          break;
        }
        try {
          // duplicated from 'pdf-images' (different progress update)
          const imageFragments: DMessageAttachmentFragment[] = [];
          const imageDataURLs = await pdfToImageDataURLs(new Uint8Array(input.data.slice(0)).buffer, DEFAULT_ADRAFT_IMAGE_MIMETYPE, PDF_IMAGE_QUALITY, PDF_IMAGE_PAGE_SCALE, (progress) => {
            edit(attachment.id, { outputsConversionProgress: progress / 2 }); // Update progress (0% to 50%)
          });
          for (const pdfPageImage of imageDataURLs) {
            const pdfPageImageF = await imageDataToImageAttachmentFragmentViaDBlob(pdfPageImage.mimeType, pdfPageImage.base64Data, source, `${title} (pg. ${newFragments.length + 1})`, caption, false, false);
            if (pdfPageImageF)
              imageFragments.push(pdfPageImageF);
          }

          // duplicated from 'pdf-text'
          const pdfText = await pdfToText(new Uint8Array(input.data.slice(0)).buffer, (progress: number) => {
            edit(attachment.id, { outputsConversionProgress: 0.5 + progress / 2 }); // Update progress (50% to 100%)
          });
          if (pdfText.trim().length < 2) {
            // Do not warn the user, as hopefully the images are useful
          } else {
            const textFragment = createDocAttachmentFragment(title, caption, DVMimeType.TextPlain, createDMessageDataInlineText(pdfText, 'text/plain'), refString, DOCPART_DEFAULT_VERSION, { ...docMeta, srcOcrFrom: 'pdf' });
            newFragments.push(textFragment);
          }

          // Add the text fragment first, then the image fragments
          newFragments.push(...imageFragments);
        } catch (error) {
          console.error('Error converting PDF to text and images:', error);
        }
        break;


      // docx to html
      case 'docx-to-html':
        if (!(input.data instanceof ArrayBuffer)) {
          console.log('Expected ArrayBuffer for DOCX converter, got:', typeof input.data);
          break;
        }
        try {
          const { convertDocxToHTML } = await import('./file-converters/DocxToMarkdown');
          const { html } = await convertDocxToHTML(input.data);
          newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.VndAgiCode, createDMessageDataInlineText(html, 'text/html'), refString, DOCPART_DEFAULT_VERSION, docMeta));
        } catch (error) {
          console.error('Error in DOCX to Markdown conversion:', error);
        }
        break;


      // url page text
      case 'url-page-text':
        if (!input.data || input.mimeType !== INT_MIME_VND_AGI_WEBPAGE || !(input.data as DraftWebInputData).pageText) {
          console.log('Expected WebPageInputData for url-page-text, got:', input.data);
          break;
        }
        const pageTextData = createDMessageDataInlineText((input.data as DraftWebInputData).pageText!, 'text/plain');
        newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.TextPlain, pageTextData, refString, DOCPART_DEFAULT_VERSION, docMeta));
        break;

      // url page markdown
      case 'url-page-markdown':
        if (!input.data || input.mimeType !== INT_MIME_VND_AGI_WEBPAGE || !(input.data as DraftWebInputData).pageMarkdown) {
          console.log('Expected WebPageInputData for url-page-markdown, got:', input.data);
          break;
        }
        const pageMarkdownData = createDMessageDataInlineText((input.data as DraftWebInputData).pageMarkdown!, 'text/markdown');
        newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.VndAgiCode, pageMarkdownData, refString, DOCPART_DEFAULT_VERSION, docMeta));
        break;

      // url page html
      case 'url-page-html':
        if (!input.data || input.mimeType !== INT_MIME_VND_AGI_WEBPAGE || !(input.data as DraftWebInputData).pageCleanedHtml) {
          console.log('Expected WebPageInputData for url-page-html, got:', input.data);
          break;
        }
        const pageHtmlData = createDMessageDataInlineText((input.data as DraftWebInputData).pageCleanedHtml!, 'text/html');
        newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.VndAgiCode, pageHtmlData, refString, DOCPART_DEFAULT_VERSION, docMeta));
        break;

      // url page null
      case 'url-page-null':
        // user chose to not attach any version of the page
        break;

      // url page image
      case 'url-page-image':
        if (!input.urlImage) {
          console.log('Expected URL image data for url-image, got:', input.urlImage);
          break;
        }
        try {
          // get the data
          const { mimeType, imgDataUrl } = input.urlImage;
          const dataIndex = imgDataUrl.indexOf(',');
          const base64Data = imgDataUrl.slice(dataIndex + 1);
          // do not convert, as we're in the optimal webp already
          // do not resize, as the 512x512 is optimal for most LLM Vendors, an a great tradeoff of quality/size/cost
          const screenshotImageF = await imageDataToImageAttachmentFragmentViaDBlob(mimeType, base64Data, source, `Screenshot of ${title}`, caption, false, false);
          if (screenshotImageF)
            newFragments.push(screenshotImageF);
        } catch (error) {
          console.error('Error attaching screenshot URL image:', error);
        }
        break;


      // youtube transcript
      case 'youtube-transcript':
      case 'youtube-transcript-simple':
        if (!input.data || input.mimeType !== INT_MIME_VND_AGI_YOUTUBE) {
          console.log('Expected YouTubeInputData for youtube-transcript, got:', input.data);
          break;
        }
        const youtubeData = input.data as DraftYouTubeInputData;
        const transcriptText =
          converter.id === 'youtube-transcript-simple' ? youtubeData.videoTranscript
            : `**YouTube Title**: ${youtubeData.videoTitle}\n\n**YouTube Description**: ${youtubeData.videoDescription}\n\n**YouTube Transcript**:\n${youtubeData.videoTranscript}\n`;
        const transcriptTextData = createDMessageDataInlineText(transcriptText, 'text/plain');
        newFragments.push(createDocAttachmentFragment(title, caption, DVMimeType.TextPlain, transcriptTextData, refString, DOCPART_DEFAULT_VERSION, docMeta, undefined));
        break;


      // ego: message
      case 'ego-fragments-inlined':
        if (!input.data || input.mimeType !== INT_MIME_VND_AGI_EGO_FRAGMENTS || !(input.data as DraftEgoFragmentsInputData).fragments?.length) {
          console.log('Expected non-empty EgoFragmentsInputData for ego-fragments-inlined, got:', input.data);
          break;
        }
        const draftEgoData = input.data as DraftEgoFragmentsInputData;
        for (const fragment of draftEgoData.fragments) {
          if (isContentOrAttachmentFragment(fragment)) {
            if (isDocPart(fragment.part)) {
              console.log('Skipping doc part in ego-fragments-inlined:', fragment);
              continue;
            }
            const fragmentTitle = `Chat Message: ${attachment.label}`;
            const fragmentCaption = 'From chat: ' + draftEgoData.conversationTitle;
            const fragmentRef = humanReadableHyphenated(refString + '-' + draftEgoData.messageId + '-' + fragment.fId);
            newFragments.push(specialContentPartToDocAttachmentFragment(fragmentTitle, fragmentCaption, DVMimeType.TextPlain, fragment.part, fragmentRef, docMeta));
          }
        }
        break;


      case 'unhandled':
        // force the user to explicitly select 'as text' if they want to proceed
        break;
    }
  }

  // update
  replaceOutputFragments(attachment.id, newFragments);
  edit(attachment.id, {
    outputsConverting: false,
    outputsConversionProgress: null,
  });
}


function _inputDataToString(data: AttachmentDraftInput['data']): string {
  if (typeof data === 'string')
    return data;
  if (data instanceof ArrayBuffer)
    return new TextDecoder('utf-8', { fatal: false }).decode(data);
  console.log('attachment._inputDataToString: expected string or ArrayBuffer, got:', typeof data);
  return '';
}


/**
 * Special function to convert a list of files to Attachment Fragments, without passing through the attachments system
 *
 * Uses the default conversion whenever multiple are available, as we don't have the chance to ask
 * for user input here, whereas we do in the Attachments UI.
 *
 * Only returns the fragments that were successfully converted.
 */
export async function convertFilesToDAttachmentFragments(origin: AttachmentDraftSourceOriginFile, files: FileWithHandle[], options: AttachmentCreationOptions): Promise<DMessageAttachmentFragment[]> {
  const validOutputFragmentsList: DMessageAttachmentFragment[][] = [];

  for (const fileWithHandle of files) {

    // This is the draft we'll edit and update
    const _draft = attachmentCreate({
      media: 'file', origin, fileWithHandle, refPath: fileWithHandle.name,
    });

    // Function to update the attachment draft
    const updateDraft =
      (changes: Partial<Omit<AttachmentDraft, 'outputFragments'>>) => Object.assign(_draft, changes);

    try {
      // 1. Load the input
      await attachmentLoadInputAsync(_draft.source, updateDraft);
      if (!_draft.input) {
        console.warn('', `Failed to load input for file: ${fileWithHandle.name}`);
        continue;
      }

      // 2. Define converters
      attachmentDefineConverters(_draft.source, _draft.input, options, updateDraft);
      if (!_draft.converters.length) {
        console.warn(`No converters defined for file: ${fileWithHandle.name}`);
        continue;
      }

      // 3. Select the already (pre-selected) active, or the first (non-disabled) Converter
      if (_draft.converters.findIndex(_c => _c.isActive) === -1) {
        let activateIndex = _draft.converters.findIndex(_c => !_c.disabled);
        if (activateIndex === -1)
          activateIndex = 0;
        _draft.converters[activateIndex].isActive = true;
      }

      // 4. Perform conversion
      await attachmentPerformConversion(_draft,
        (_, update) => updateDraft(update),
        (_, fragments) => _draft.outputFragments = fragments,
      );
      if (!_draft.outputFragments.length) {
        console.warn(`[DEV] Failed to convert file: ${fileWithHandle.name}`, _draft);
        continue;
      }

      validOutputFragmentsList.push(_draft.outputFragments);
    } catch (error) {
      console.warn(`Error processing file ${fileWithHandle.name}:`, error);
      // allFragments.push([]);  // Add an empty array for failed conversions
    }
  }

  // flatten the list of lists
  return validOutputFragmentsList.flat();
}