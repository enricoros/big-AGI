import * as React from 'react';
import { shallow } from 'zustand/shallow';
import type { FileWithHandle } from 'browser-fs-access';

import { addSnackbar } from '~/common/components/useSnackbarsStore';
import { asValidURL } from '~/common/util/urlUtils';
import { extractFilePathsWithCommonRadix } from '~/common/util/dropTextUtils';
import { getClipboardItems } from '~/common/util/clipboardUtils';

import { AttachmentSourceOriginDTO, AttachmentSourceOriginFile, useAttachmentsStore } from './store-attachments';


// enable to debug attachment operations
const ATTACHMENTS_DEBUG_INTAKE = false;


export const useAttachments = (enableLoadURLs: boolean) => {

  // state

  const { attachments, clearAttachments, createAttachment, removeAttachment } = useAttachmentsStore(state => ({
    attachments: state.attachments,
    clearAttachments: state.clearAttachments,
    createAttachment: state.createAttachment,
    removeAttachment: state.removeAttachment,
  }), shallow);


  // Creation helpers

  const attachAppendFile = React.useCallback((origin: AttachmentSourceOriginFile, fileWithHandle: FileWithHandle, overrideFileName?: string) => {
    if (ATTACHMENTS_DEBUG_INTAKE)
      console.log('attachAppendFile', origin, fileWithHandle, overrideFileName);

    return createAttachment({
      media: 'file', origin, fileWithHandle, refPath: overrideFileName || fileWithHandle.name,
    });
  }, [createAttachment]);


  const attachAppendDataTransfer = React.useCallback((dt: DataTransfer, method: AttachmentSourceOriginDTO, attachText: boolean): 'as_files' | 'as_url' | 'as_text' | false => {

    // https://github.com/enricoros/big-AGI/issues/286
    const textHtml = dt.getData('text/html') || '';
    const heuristicIsExcel = textHtml.includes('"urn:schemas-microsoft-com:office:excel"');
    // noinspection HttpUrlsUsage
    const heuristicIsPowerPoint = textHtml.includes('xmlns:m="http://schemas.microsoft.com/office/20') && textHtml.includes('<meta name=Generator content="Microsoft PowerPoint');
    const heuristicBypassImage = heuristicIsExcel || heuristicIsPowerPoint;

    if (ATTACHMENTS_DEBUG_INTAKE)
      console.log('attachAppendDataTransfer', dt.types, dt.items, dt.files, textHtml);

    // attach File(s)
    if (dt.files.length >= 1 && !heuristicBypassImage /* special case: ignore images from Microsoft Office pastes (prioritize the HTML paste) */) {
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


  const attachAppendEgoMessage = React.useCallback((blockTitle: string, textPlain: string, attachmentLabel: string) => {
    if (ATTACHMENTS_DEBUG_INTAKE)
      console.log('attachAppendEgo', { blockTitle, textPlain, attachmentLabel });

    return createAttachment({
      media: 'ego', method: 'ego-message', label: attachmentLabel, blockTitle: blockTitle, textPlain: textPlain,
    });
  }, [createAttachment]);


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

    // loop on all the clipboard items
    for (const clipboardItem of clipboardItems) {

      // https://github.com/enricoros/big-AGI/issues/286
      const textHtml = clipboardItem.types.includes('text/html') ? await clipboardItem.getType('text/html').then(blob => blob.text()) : '';
      const heuristicBypassImage = textHtml.startsWith('<table ');

      if (ATTACHMENTS_DEBUG_INTAKE)
        console.log(' - attachAppendClipboardItems.item:', clipboardItem, textHtml, heuristicBypassImage);

      // attach as image
      let imageAttached = false;
      for (const mimeType of clipboardItem.types) {
        if (mimeType.startsWith('image/') && !heuristicBypassImage) {
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

    // create attachments
    attachAppendClipboardItems,
    attachAppendDataTransfer,
    attachAppendEgoMessage,
    attachAppendFile,

    // manage attachments
    clearAttachments,
    removeAttachment,
  };
};