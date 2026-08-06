import * as React from 'react';
import type { FileWithHandle } from 'browser-fs-access';

import type { CameraCaptureDialogOptions } from '~/common/components/camera/useCameraCaptureDialog';
import type { CameraLiveStream } from '~/common/components/camera/useCameraCapture';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { useCameraCaptureDialog } from '~/common/components/camera/useCameraCaptureDialog';

import type { AttachmentDraftsApi } from '../useAttachmentDrafts';
import { useWebAttachmentModal } from './useWebAttachmentModal';


// Focused hooks that bridge `useAttachmentDrafts` return values to UI callback shapes.
// Each hook wraps one attachment source. Consumers compose only what they need.

type _HandleCameraOpen = (options?: CameraCaptureDialogOptions) => Promise<void>;
type _HandleFiles = (files: FileWithHandle[], errorMessage: string | null) => void;
type _HandlePasteIntercept = (event: React.ClipboardEvent) => void;
type _HandleScreenCapture = (file: File) => void;
type _HandleWebLinks = (links: { url: string }[]) => void;


/**
 * Returns a handler that opens the camera capture dialog and appends the captured files.
 */
export function useAttachHandler_CameraOpen(
  attachAppendFile: AttachmentDraftsApi['attachAppendFile'],
  handleLiveStream?: (stream: CameraLiveStream) => void,
): _HandleCameraOpen {

  // external state
  const { openCameraCapture } = useCameraCaptureDialog(); // -> showPromisedOverlay

  return React.useCallback(async (optionsOrEvent?: CameraCaptureDialogOptions | React.SyntheticEvent) => {

    // guard: onClick handlers pass the event as first arg
    const options = optionsOrEvent && 'nativeEvent' in optionsOrEvent ? undefined : optionsOrEvent;

    const result = await openCameraCapture({ allowMultiCapture: true, allowLiveFeed: !!handleLiveStream, ...options });
    if (!result) return; // user dismissed the dialog without capturing anything

    // append all captured images
    for (const imageFile of result.images)
      void attachAppendFile('camera', imageFile);

    // handle live stream if provided
    if (result.liveStream)
      handleLiveStream?.(result.liveStream);

  }, [attachAppendFile, handleLiveStream, openCameraCapture]);
}

/**
 * Returns a handler for files to become attachments.
 */
export function useAttachHandler_Files(attachAppendFile: AttachmentDraftsApi['attachAppendFile']) {
  return React.useCallback<_HandleFiles>(async (files, errorMessage) => {

    if (errorMessage)
      addSnackbar({ key: 'attach-files-open-fail', message: `Unable to open files: ${errorMessage}`, type: 'issue' });

    // files are appended sequentially (awaited) so conversion pipelines don't race
    for (const file of files)
      await attachAppendFile('file-open', file)
        .catch((error: any) => addSnackbar({ key: 'attach-file-open-fail', message: `Unable to attach the file "${file.name}" (${error?.message || error?.toString() || 'unknown error'})`, type: 'issue' }));

  }, [attachAppendFile]);
}

/**
 * Returns a paste handler that intercepts Ctrl+V, routing pasted files through the attachment pipeline.
 */
export function useAttachHandler_PasteIntercept(attachAppendDataTransfer: AttachmentDraftsApi['attachAppendDataTransfer']) {
  return React.useCallback<_HandlePasteIntercept>(async (event) => {

    // false = don't attach text (only files), to prevent duplicate text in input
    if (await attachAppendDataTransfer(event.clipboardData, 'paste', false) === 'as_files') {
      // preventDefault stops the browser's default paste only when files were captured
      event.preventDefault();
    }

  }, [attachAppendDataTransfer]);
}

/**
 * Returns a handler for screen/window/tab captures to become attachments.
 */
export function useAttachHandler_ScreenCapture(attachAppendFile: AttachmentDraftsApi['attachAppendFile']) {
  return React.useCallback<_HandleScreenCapture>((file) => {

    void attachAppendFile('screencapture', file);

  }, [attachAppendFile]);
}

/**
 * Returns `{ openWebInputDialog, webInputDialogComponent }` for web link attachments.
 * Consumer must render `webInputDialogComponent`.
 */
export function useAttachHandler_UrlWebLinks(attachAppendUrl: AttachmentDraftsApi['attachAppendUrl'], composerText?: string) {

  // local handler
  const _handleAttachWebLinks = React.useCallback<_HandleWebLinks>(async (links) => {

    // processd in parallel
    const attachPromises = links.map(link => attachAppendUrl('input-link', link.url));

    // find if any failed
    const results = await Promise.allSettled(attachPromises);
    const issueUrls = results.reduce<string[]>((acc, result, index) => {
      if (result.status === 'rejected')
        acc.push(links[index].url);
      return acc;
    }, []);
    if (issueUrls.length)
      addSnackbar({ key: 'attach-web-fail', message: `Unable to attach: ${issueUrls.join(', ')}`, type: 'issue', overrides: { autoHideDuration: 4000 } });

  }, [attachAppendUrl]);

  // return the component and open() function
  // optional composerText is passed to the modal for URL auto-detection from the current input text
  return useWebAttachmentModal(_handleAttachWebLinks, composerText);
}
