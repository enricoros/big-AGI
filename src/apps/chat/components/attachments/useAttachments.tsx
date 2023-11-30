import * as React from 'react';
import { shallow } from 'zustand/shallow';
import type { FileWithHandle } from 'browser-fs-access';

import { addSnackbar } from '~/common/components/useSnackbarsStore';
import { asValidURL } from '~/common/util/urlUtils';
import { extractFilePathsWithCommonRadix } from '~/common/util/dropTextUtils';
import { getClipboardItems } from '~/common/util/clipboardUtils';

import { AttachmentDTOrigin, AttachmentFileOrigin } from './attachment.types';
import { useAttachmentsStore } from './store-attachments';


export const useAttachments = (enableUrlAttachments: boolean) => {

  // state
  const { attachments, clearAttachments, createAttachment, removeAttachment } = useAttachmentsStore(state => ({
    attachments: state.attachments,
    clearAttachments: state.clearAttachments,
    createAttachment: state.createAttachment,
    removeAttachment: state.removeAttachment,
  }), shallow);


  // Convenience functions

  const attachAppendFile = React.useCallback((origin: AttachmentFileOrigin, fileWithHandle: FileWithHandle, overrideName?: string) => {
    createAttachment({
      type: 'file',
      origin,
      fileWithHandle,
      name: overrideName || fileWithHandle.name,
    });
  }, [createAttachment]);

  const attachAppendDataTransfer = React.useCallback((dataTransfer: DataTransfer, method: AttachmentDTOrigin, attachText: boolean): 'as_files' | 'as_url' | 'as_text' | false => {

    // attach File(s)
    if (dataTransfer.files.length >= 1) {
      // rename files from a common prefix, to better relate them (if the transfer contains a list of paths)
      let overrideFileNames: string[] = [];
      if (dataTransfer.types.includes('text/plain')) {
        const plainText = dataTransfer.getData('text/plain');
        overrideFileNames = extractFilePathsWithCommonRadix(plainText);
      }

      // attach as Files
      const overrideNames = overrideFileNames.length === dataTransfer.files.length;
      for (let i = 0; i < dataTransfer.files.length; i++) {
        // drag/drop of folders (or .tsx from IntelliJ) will have no type
        if (!dataTransfer.files[i].type) {
          // NOTE: we are fixing it in resolveInputAsync, but would be better to do it here
        }
        attachAppendFile(method, dataTransfer.files[i], overrideNames ? overrideFileNames[i] || undefined : undefined);
      }
      return 'as_files';
    }

    // attach as URL
    const textPlain = dataTransfer.getData('text/plain') || '';
    if (textPlain && enableUrlAttachments) {
      const textPlainUrl = asValidURL(textPlain);
      if (textPlainUrl && textPlainUrl.trim()) {
        createAttachment({
          type: 'url', url: textPlainUrl.trim(), refName: textPlain,
        });
        return 'as_url';
      }
    }

    // attach as Text/Html (further conversion, e.g. to markdown is done later)
    const textHtml = dataTransfer.getData('text/html') || '';
    if (attachText && (textHtml || textPlain)) {
      createAttachment({
        type: 'text', method, textPlain, textHtml,
      });
      return 'as_text';
    }

    if (attachText)
      console.warn(`Unhandled '${method}' attachment: `, dataTransfer.types?.map(t => `${t}: ${dataTransfer.getData(t)}`));

    // did not attach anything from this data transfer
    return false;
  }, [attachAppendFile, createAttachment, enableUrlAttachments]);

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
            const imageFile = new File([imageBlob], 'clipboard.png', { type: mimeType });
            attachAppendFile('clipboard-read', imageFile, imageFile.name?.replace('image.', 'clipboard.'));
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
      if (textPlain && enableUrlAttachments) {
        const textPlainUrl = asValidURL(textPlain);
        if (textPlainUrl && textPlainUrl.trim()) {
          createAttachment({
            type: 'url', url: textPlainUrl.trim(), refName: textPlain,
          });
          continue;
        }
      }

      // attach as Text
      const textHtml = clipboardItem.types.includes('text/html') ? await clipboardItem.getType('text/html').then(blob => blob.text()) : '';
      if (textHtml || textPlain) {
        createAttachment({
          type: 'text', method: 'clipboard-read', textPlain, textHtml,
        });
        continue;
      }

      console.warn('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  }, [attachAppendFile, createAttachment, enableUrlAttachments]);


  return {
    // state
    attachments,
    attachmentsReady: !attachments.length || attachments.every(attachment => !!attachment.outputs && attachment.outputs.every(output => output.isEjectable)),

    // create attachments
    attachAppendClipboardItems,
    attachAppendDataTransfer,
    attachAppendFile,

    // manage attachments
    clearAttachments,
    removeAttachment,
  };
};