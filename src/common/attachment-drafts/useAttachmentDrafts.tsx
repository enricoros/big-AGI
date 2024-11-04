import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { FileWithHandle } from 'browser-fs-access';

import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { asValidURL } from '~/common/util/urlUtils';
import { getClipboardItems } from '~/common/util/clipboardUtils';

import type { DConversationId } from '~/common/stores/chat/chat.conversation';
import type { DMessageFragment } from '~/common/stores/chat/chat.fragments';
import type { DMessageId } from '~/common/stores/chat/chat.message';
import { getAllFilesFromDirectoryRecursively, getDataTransferFilesOrPromises } from '~/common/util/fileSystemUtils';
import { useChatAttachmentsStore } from '~/common/chat-overlay/store-perchat_vanilla';

import type { AttachmentDraftSourceOriginDTO, AttachmentDraftSourceOriginFile } from './attachment.types';
import type { AttachmentDraftsStoreApi } from './store-perchat-attachment-drafts_slice';


// enable to debug operations
const ATTACHMENTS_DEBUG_INTAKE = false;


export const useAttachmentDrafts = (attachmentsStoreApi: AttachmentDraftsStoreApi | null, enableLoadURLs: boolean, hintAddImages: boolean, onFilterAGIFile: (file: File) => Promise<boolean>) => {

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

    // special case: intercept AGI files to potentially load them instead of attaching them
    if (fileWithHandle.name.endsWith('.agi.json'))
      if (await onFilterAGIFile(fileWithHandle))
        return;

    return _createAttachmentDraft({
      media: 'file', origin, fileWithHandle, refPath: overrideFileName || fileWithHandle.name,
    }, { hintAddImages });
  }, [_createAttachmentDraft, hintAddImages, onFilterAGIFile]);

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
    const fileOrFSHandlePromises = heuristicBypassImage
      ? [] /* special case: ignore images from Microsoft Office pastes (prioritize the HTML paste) */
      : getDataTransferFilesOrPromises(dt.items, true);

    // attach File(s)
    if (fileOrFSHandlePromises.length) {

      // rename files from a common prefix, to better relate them (if the transfer contains a list of paths)
      let overrideFileNames: string[] = [];
      if (dt.types.includes('text/plain')) {
        const possiblePlainTextURIs: string[] = dt.getData('text/plain').split(/[\r\n]+/);
        overrideFileNames = mapFileURIsRemovingCommonRadix(possiblePlainTextURIs);
        if (overrideFileNames.length !== fileOrFSHandlePromises.length)
          overrideFileNames = [];
        else if (ATTACHMENTS_DEBUG_INTAKE)
          console.log(' - renamed to:', overrideFileNames);
      }

      for (let fIdx = 0; fIdx < fileOrFSHandlePromises.length; fIdx++) {
        const fileOrFSHandlePromise = fileOrFSHandlePromises[fIdx];

        // Files: nothing to do - Note: some browsers will interpret directories as files and
        // not provide a handle; if that's the case, we can't do anything, so we still add the file
        if (fileOrFSHandlePromise instanceof File) {
          const file = fileOrFSHandlePromise;

          // Directory detection from File objects weak or impossible - e.g. Firefox reports directories with size > 0 on windows (e.g. 4096)
          if (file.type === '' && file.size === 0) {
            console.warn('This browser does not support directories:', file);
          }

          await attachAppendFile(method, file, overrideFileNames[fIdx]);
          continue;
        }

        // Resolve the file system handle
        const fileSystemHandleOrFile = await fileOrFSHandlePromise;

        // Special case: the resolution just returned a File object
        if (fileSystemHandleOrFile instanceof File) {
          await attachAppendFile(method, fileSystemHandleOrFile, overrideFileNames[fIdx]);
          continue;
        }

        // Preferred case: the resolution returned a file system File or Directory handle
        const fileSystemHandle = fileSystemHandleOrFile;
        switch (fileSystemHandle?.kind) {

          // attach file with handle
          case 'file':
            const fileWithHandle = await fileSystemHandle.getFile() as FileWithHandle;
            fileWithHandle.handle = fileSystemHandle;
            await attachAppendFile(method, fileWithHandle, overrideFileNames[fIdx]);
            break;

          // attach all files in a directory as files with handles
          case 'directory':
            for (const { fileWithHandle, relativeName } of await getAllFilesFromDirectoryRecursively(fileSystemHandle))
              await attachAppendFile(method, fileWithHandle, relativeName);
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
        }, { hintAddImages});

        return 'as_url';
      }
    }

    // attach as Text/Html (further conversion, e.g. to markdown is done later)
    if (attachText && (textHtml || textPlain)) {
      void _createAttachmentDraft({
        media: 'text', method, textPlain, textHtml,
      }, { hintAddImages });

      return 'as_text';
    }

    if (attachText)
      console.warn(`Unhandled '${method}' attachment: `, dt.types?.map(t => `${t}: ${dt.getData(t)}`));

    // did not attach anything from this data transfer
    return false;
  }, [_createAttachmentDraft, attachAppendFile, enableLoadURLs, hintAddImages]);

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
          }, { hintAddImages });
          continue;
        }
      }

      // attach as Text
      if (textHtml || textPlain) {
        void _createAttachmentDraft({
          media: 'text', method: 'clipboard-read', textPlain, textHtml,
        }, { hintAddImages });
        continue;
      }

      console.warn('Clipboard item has no text/html or text/plain item.', clipboardItem.types, clipboardItem);
    }
  }, [_createAttachmentDraft, attachAppendFile, enableLoadURLs, hintAddImages]);

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
    }, { hintAddImages });
  }, [_createAttachmentDraft, hintAddImages]);


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


/**
 * Maps a list of file URIs to relative paths, removing a common prefix.
 *
 * Example, takes the following files:
 * - file:///C:/Users/Me/Documents/MyFile1.txt
 * - file:///C:/Users/Me/Documents/Test/MyFile2.txt
 * - file:///C:/Users/Me/Documents/Test/MyFile3.txt
 * And returns:
 * - [ MyFile1.txt, Test/MyFile2.txt, Test/MyFile3.txt ]
 */
function mapFileURIsRemovingCommonRadix(fileURIs: string[]): string[] {

  const filePaths = fileURIs
    .filter((path) => path.startsWith('file:'))
    .map((path) => path.slice(5));

  if (filePaths.length < 2)
    return [];

  const commonRadix = _findCommonStringsPrefix(filePaths);
  if (!commonRadix.endsWith('/'))
    return [];

  return filePaths.map((path) => path.slice(commonRadix.length));
}

function _findCommonStringsPrefix(strings: string[]) {
  if (!strings.length)
    return '';

  const sortedStrings = strings.slice().sort();
  const firstString = sortedStrings[0];
  const lastString = sortedStrings[sortedStrings.length - 1];

  let commonPrefix = '';
  for (let i = 0; i < firstString.length; i++) {
    if (firstString[i] === lastString[i]) {
      commonPrefix += firstString[i];
    } else {
      break;
    }
  }

  return commonPrefix;
}
