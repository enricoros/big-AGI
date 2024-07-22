import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { FileWithHandle } from 'browser-fs-access';

import { addSnackbar } from '~/common/components/useSnackbarsStore';
import { asValidURL } from '~/common/util/urlUtils';
import { getClipboardItems } from '~/common/util/clipboardUtils';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessageId } from '~/common/stores/chat/chat.message';
import { useChatAttachmentsStore } from '~/common/chats/store-chat-overlay';

import type { AttachmentDraftSourceOriginDTO, AttachmentDraftSourceOriginFile } from './attachment.types';
import type { AttachmentDraftsStoreApi } from './store-attachment-drafts-slice';
import { extractFilePathsFromCommonRadix, extractFileSystemHandlesOrFiles, getAllFilesFromDirectoryRecursively, mightBeDirectory } from './file-converters/filesystem-helpers';


// enable to debug operations
const ATTACHMENTS_DEBUG_INTAKE = false;


export const useAttachmentDrafts = (attachmentsStoreApi: AttachmentDraftsStoreApi | null, enableLoadURLs: boolean) => {

  // state
  const { _createAttachmentDraft, attachmentDrafts, attachmentsRemoveAll, attachmentsTakeAllFragments, attachmentsTakeFragmentsByType } = useChatAttachmentsStore(attachmentsStoreApi, useShallow(state => ({
    _createAttachmentDraft: state.createAttachmentDraft,
    attachmentDrafts: state.attachmentDrafts,
    attachmentsRemoveAll: state.removeAllAttachmentDrafts,
    attachmentsTakeAllFragments: state.takeAllFragments,
    attachmentsTakeFragmentsByType: state.takeFragmentsByType,
  })));


  // Creation helpers

  /**
   * Append a file to the attachments.
   */
  const attachAppendFile = React.useCallback(async (origin: AttachmentDraftSourceOriginFile, fileWithHandle: FileWithHandle, overrideFileName?: string) => {
    if (ATTACHMENTS_DEBUG_INTAKE)
      console.log('attachAppendFile', origin, fileWithHandle, overrideFileName);

    return _createAttachmentDraft({
      media: 'file', origin, fileWithHandle, refPath: overrideFileName || fileWithHandle.name,
    });
  }, [_createAttachmentDraft]);

  /**
   * Append data transfer to the attachments.
   */
  const attachAppendDataTransfer = React.useCallback(async (dt: DataTransfer, method: AttachmentDraftSourceOriginDTO, attachText: boolean): Promise<'as_files' | 'as_url' | 'as_text' | false> => {

    // https://github.com/enricoros/big-AGI/issues/286
    const textHtml = dt.getData('text/html') || '';
    const heuristicIsExcel = textHtml.includes('"urn:schemas-microsoft-com:office:excel"');
    // noinspection HttpUrlsUsage
    const heuristicIsPowerPoint = textHtml.includes('xmlns:m="http://schemas.microsoft.com/office/20') && textHtml.includes('<meta name=Generator content="Microsoft PowerPoint');
    const heuristicBypassImage = heuristicIsExcel || heuristicIsPowerPoint;

    if (ATTACHMENTS_DEBUG_INTAKE) {
      console.log('\nattachAppendDataTransfer', dt.types, `items: ${dt.items.length}, files: ${dt.files.length}, textHtml: ${textHtml}`);
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        console.log(' - item:', item.kind, item.type, item.getAsFile());
      }
    }

    // get the file items - note: important to not have any async/await or we'll lose the items of the data transfer
    const fileOrFSHandlePromises: (Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null> | File)[] = heuristicBypassImage
      ? [] /* special case: ignore images from Microsoft Office pastes (prioritize the HTML paste) */
      : extractFileSystemHandlesOrFiles(dt.items);

    // attach File(s)
    if (fileOrFSHandlePromises.length) {

      // rename files from a common prefix, to better relate them (if the transfer contains a list of paths)
      let overrideFileNames: string[] = [];
      if (dt.types.includes('text/plain')) {
        const possiblePlainTextURIs: string[] = dt.getData('text/plain').split(/[\r\n]+/);
        overrideFileNames = extractFilePathsFromCommonRadix(possiblePlainTextURIs);
        if (overrideFileNames.length !== fileOrFSHandlePromises.length)
          overrideFileNames = [];
        else if (ATTACHMENTS_DEBUG_INTAKE)
          console.log(' - renamed to:', overrideFileNames);
      }

      for (let i = 0; i < fileOrFSHandlePromises.length; i++) {
        const fileOrFSHandlePromise = fileOrFSHandlePromises[i];

        // Files: nothing to do - Note: some browsers will interpret directories as files and
        // not provide a handle; if that's the case, we can't do anything, so we still add the file
        if (fileOrFSHandlePromise instanceof File) {
          if (mightBeDirectory(fileOrFSHandlePromise)) {
            console.warn('This browser does not support directories:', fileOrFSHandlePromise);
          }
          await attachAppendFile(method, fileOrFSHandlePromise, overrideFileNames[i]);
          continue;
        }

        // Resolve the file system handle
        const fileSystemHandle = await fileOrFSHandlePromise;
        switch (fileSystemHandle?.kind) {

          // attach file with handle
          case 'file':
            const file = await fileSystemHandle.getFile();
            (file as FileWithHandle).handle = fileSystemHandle;
            await attachAppendFile(method, file, overrideFileNames[i]);
            break;

          // attach all files in a directory as files with handles
          case 'directory':
            const filesWithHandles: FileWithHandle[] = await getAllFilesFromDirectoryRecursively(fileSystemHandle);
            // print full paths of files
            if (ATTACHMENTS_DEBUG_INTAKE)
              console.log(' - directory:', fileSystemHandle.name, filesWithHandles.map(f => f.name));
            for (const fileWithHandle of filesWithHandles)
              await attachAppendFile(method, fileWithHandle);
            break;

          default:
            console.warn('Unhandled file system handle kind:', fileSystemHandle);
            break;

        }
      }

      return 'as_files';
    }

    // attach as URL
    const textPlain = dt.getData('text/plain') || '';
    if (textPlain && enableLoadURLs) {
      const textPlainUrl = asValidURL(textPlain);
      if (textPlainUrl && textPlainUrl.trim()) {
        void _createAttachmentDraft({
          media: 'url', url: textPlainUrl, refUrl: textPlain,
        });

        return 'as_url';
      }
    }

    // attach as Text/Html (further conversion, e.g. to markdown is done later)
    if (attachText && (textHtml || textPlain)) {
      void _createAttachmentDraft({
        media: 'text', method, textPlain, textHtml,
      });

      return 'as_text';
    }

    if (attachText)
      console.warn(`Unhandled '${method}' attachment: `, dt.types?.map(t => `${t}: ${dt.getData(t)}`));

    // did not attach anything from this data transfer
    return false;
  }, [attachAppendFile, _createAttachmentDraft, enableLoadURLs]);

  /**
   * Append clipboard items to the attachments.
   */
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
          void _createAttachmentDraft({
            media: 'url', url: textPlainUrl.trim(), refUrl: textPlain,
          });
          continue;
        }
      }

      // attach as Text
      if (textHtml || textPlain) {
        void _createAttachmentDraft({
          media: 'text', method: 'clipboard-read', textPlain, textHtml,
        });
        continue;
      }

      console.warn('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  }, [attachAppendFile, _createAttachmentDraft, enableLoadURLs]);

  /**
   * Append ego content to the attachments.
   */
  const attachAppendEgoFragments = React.useCallback((fragments: DMessageFragment[], label: string, conversationTitle: string, conversationId: DConversationId, messageId: DMessageId) => {
    if (ATTACHMENTS_DEBUG_INTAKE)
      console.log('attachAppendEgoContent', fragments, label, conversationId, messageId);

    return _createAttachmentDraft({
      media: 'ego',
      method: 'ego-fragments',
      label,
      egoFragmentsInputData: {
        fragments,
        conversationTitle,
        conversationId,
        messageId,
      },
    });
  }, [_createAttachmentDraft]);


  return {
    // state
    attachmentDrafts,

    // create drafts
    attachAppendClipboardItems,
    attachAppendDataTransfer,
    attachAppendEgoFragments,
    attachAppendFile,

    // manage attachments
    attachmentsRemoveAll,
    attachmentsTakeAllFragments,
    attachmentsTakeFragmentsByType,
  };
};