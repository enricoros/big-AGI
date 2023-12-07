import * as React from 'react';
import { shallow } from 'zustand/shallow';
import type { FileWithHandle } from 'browser-fs-access';

import type { DLLMId } from '~/modules/llms/store-llms';

import { addSnackbar } from '~/common/components/useSnackbarsStore';
import { asValidURL } from '~/common/util/urlUtils';
import { countModelTokens } from '~/common/util/token-counter';
import { extractFilePathsWithCommonRadix } from '~/common/util/dropTextUtils';
import { getClipboardItems } from '~/common/util/clipboardUtils';

import type { ComposerOutputPartType } from '../composer.types';
import { AttachmentSourceOriginDTO, AttachmentSourceOriginFile, useAttachmentsStore } from './store-attachments';
import { attachmentPreviewTextEjection, attachmentsAreSupported } from './pipeline';


export const useAttachments = (supportedOutputPartTypes: ComposerOutputPartType[], llmForTokenCount: DLLMId | null, enableLoadURLs: boolean) => {

  // state
  const { attachments, clearAttachments, createAttachment, removeAttachment } = useAttachmentsStore(state => ({
    attachments: state.attachments,
    clearAttachments: state.clearAttachments,
    createAttachment: state.createAttachment,
    removeAttachment: state.removeAttachment,
  }), shallow);


  // memoed state (readiness and token count)

  const attachmentsSupported = React.useMemo(() => {
    return attachmentsAreSupported(attachments, supportedOutputPartTypes);
  }, [attachments, supportedOutputPartTypes]);

  const attachmentsTokensCount = React.useMemo(() => {
    if (!attachments?.length || !llmForTokenCount)
      return 0;

    // sum up the tokens as if we performed a full eject of all outputs
    const fusedText = attachments.reduce((fusedText, attachment) => {
      const attachmentTextPreview = attachmentPreviewTextEjection(attachment);
      if (!attachmentTextPreview)
        return fusedText;
      // FIXME
      return `${fusedText}\n\n${attachmentTextPreview.trim()}`.trim();
    }, '');

    return countModelTokens(fusedText, llmForTokenCount, 'attachments tokens count');
  }, [attachments, llmForTokenCount]);


  // Creation helpers

  const attachAppendFile = React.useCallback((origin: AttachmentSourceOriginFile, fileWithHandle: FileWithHandle, overrideFileName?: string) =>
      createAttachment({
        media: 'file', origin, fileWithHandle, refPath: overrideFileName || fileWithHandle.name,
      })
    , [createAttachment]);


  const attachAppendDataTransfer = React.useCallback((dt: DataTransfer, method: AttachmentSourceOriginDTO, attachText: boolean): 'as_files' | 'as_url' | 'as_text' | false => {

    // attach File(s)
    if (dt.files.length >= 1) {
      // rename files from a common prefix, to better relate them (if the transfer contains a list of paths)
      let overrideFileNames: string[] = [];
      if (dt.types.includes('text/plain')) {
        const plainText = dt.getData('text/plain');
        overrideFileNames = extractFilePathsWithCommonRadix(plainText);
      }
      const overrideNames = overrideFileNames.length === dt.files.length;

      // attach as Files (paste and drop keep the original filename)
      for (let i = 0; i < dt.files.length; i++) {
        const file = dt.files[i];
        // drag/drop of folders (or .tsx from IntelliJ) will have no type
        if (!file.type) {
          // NOTE: we are fixing it in attachmentLoadInputAsync, but would be better to do it here
        }
        void attachAppendFile(method, file, overrideNames ? overrideFileNames[i] || undefined : undefined);
      }
      return 'as_files';
    }

    // attach as URL
    const textPlain = dt.getData('text/plain') || '';
    if (textPlain && enableLoadURLs) {
      const textPlainUrl = asValidURL(textPlain);
      if (textPlainUrl && textPlainUrl) {
        void createAttachment({
          media: 'url', url: textPlainUrl, refUrl: textPlain,
        });
        return 'as_url';
      }
    }

    // attach as Text/Html (further conversion, e.g. to markdown is done later)
    const textHtml = dt.getData('text/html') || '';
    if (attachText && (textHtml || textPlain)) {
      void createAttachment({
        media: 'text', method, textPlain, textHtml,
      });
      return 'as_text';
    }

    if (attachText)
      console.warn(`Unhandled '${method}' attachment: `, dt.types?.map(t => `${t}: ${dt.getData(t)}`));

    // did not attach anything from this data transfer
    return false;
  }, [attachAppendFile, createAttachment, enableLoadURLs]);


  const attachAppendClipboardItems = React.useCallback(async () => {

    // if there's an issue accessing the clipboard, show it passively
    const clipboardItems = await getClipboardItems();
    if (clipboardItems === null) {
      addSnackbar({
        key: 'clipboard-issue',
        type: 'issue',
        message: 'Clipboard empty or access denied',
        overrides: {
          autoHideDuration: 2000,
        },
      });
      return;
    }

    // loop on all the possible attachments
    for (const clipboardItem of clipboardItems) {

      // attach as image
      let imageAttached = false;
      for (const mimeType of clipboardItem.types) {
        if (mimeType.startsWith('image/')) {
          try {
            const imageBlob = await clipboardItem.getType(mimeType);
            const imageName = mimeType.replace('image/', 'clipboard.').replaceAll('/', '.') || 'clipboard.png';
            const imageFile = new File([imageBlob], imageName, { type: mimeType });
            void attachAppendFile('clipboard-read', imageFile);
            imageAttached = true;
          } catch (error) {
            // ignore getType error..
          }
        }
      }
      if (imageAttached)
        continue;

      // get the Plain text
      const textPlain = clipboardItem.types.includes('text/plain') ? await clipboardItem.getType('text/plain').then(blob => blob.text()) : '';

      // attach as URL
      if (textPlain && enableLoadURLs) {
        const textPlainUrl = asValidURL(textPlain);
        if (textPlainUrl && textPlainUrl.trim()) {
          void createAttachment({
            media: 'url', url: textPlainUrl.trim(), refUrl: textPlain,
          });
          continue;
        }
      }

      // attach as Text
      const textHtml = clipboardItem.types.includes('text/html') ? await clipboardItem.getType('text/html').then(blob => blob.text()) : '';
      if (textHtml || textPlain) {
        void createAttachment({
          media: 'text', method: 'clipboard-read', textPlain, textHtml,
        });
        continue;
      }

      console.warn('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  }, [attachAppendFile, createAttachment, enableLoadURLs]);


  return {
    // state
    attachments,
    attachmentsSupported,
    attachmentsTokensCount,

    // create attachments
    attachAppendClipboardItems,
    attachAppendDataTransfer,
    attachAppendFile,

    // manage attachments
    clearAttachments,
    removeAttachment,
  };
};