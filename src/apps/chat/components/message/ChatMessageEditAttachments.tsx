import * as React from 'react';

import { Box } from '@mui/joy';

import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts_slice';
import type { DMessageAttachmentFragment } from '~/common/stores/chat/chat.fragments';
import { AttachmentDraftsList } from '~/common/attachment-drafts/attachment-drafts-ui/AttachmentDraftsList';
import { AttachmentSourcesMemo } from '~/common/attachment-drafts/attachment-sources/AttachmentSources';
import { useAttachHandler_CameraOpen, useAttachHandler_Files, useAttachHandler_ScreenCapture, useAttachHandler_UrlWebLinks } from '~/common/attachment-drafts/attachment-sources/useAttachmentSourceHandlers';
import { createAttachmentDraftsVanillaStore } from '~/common/attachment-drafts/store-attachment-drafts_vanilla';
import { supportsCameraCapture } from '~/common/components/camera/useCameraCapture';
import { supportsScreenCapture } from '~/common/util/screenCaptureUtils';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useGoogleDrivePicker } from '~/common/attachment-drafts/attachment-sources/useGoogleDrivePicker';

import { ViewDocPartModal } from './fragments-content/ViewDocPartModal';
import { ViewImageRefPartModal } from './fragments-content/ViewImageRefPartModal';


/**
 * Imperative interface used outside
 */
export interface EditModeAttachmentsHandle {
  takeAllFragments: () => Promise<DMessageAttachmentFragment[]>;
}


/**
 * Encapsulates all attachment wiring for ChatMessage edit mode.
 * Owns a standalone attachment drafts store (one per edit session).
 * Exposes an imperative handle for the parent to "take" fragments on save.
 */
export const ChatMessageEditAttachments = React.forwardRef<EditModeAttachmentsHandle, { isMobile: boolean }>(
  function EditModeAttachments(props, ref) {

    // state
    const storeApiRef = React.useRef<AttachmentDraftsStoreApi | null>(null);
    if (!storeApiRef.current) storeApiRef.current = createAttachmentDraftsVanillaStore(); // created only on mount

    // external state
    const {
      attachmentDrafts,
      attachAppendClipboardItems, attachAppendCloudFile, attachAppendFile, attachAppendUrl, // attachAppendDataTransfer
      attachmentsTakeAllFragments,
    } = useAttachmentDrafts(storeApiRef.current, false, false, undefined, false);
    const browseCapability = useBrowseCapability();


    // imperative handle for parent to take fragments on save
    React.useImperativeHandle(ref, () => ({
      takeAllFragments: () => attachmentsTakeAllFragments('global', 'app-chat'),
    }), [attachmentsTakeAllFragments]);


    // [effect] cleanup on unmount - remove all drafts (deleted their DBlob assets, except for 'taken' ones)
    React.useEffect(() => {
      const store = storeApiRef.current;
      return () => {
        store?.getState().removeAllAttachmentDrafts();
      };
    }, []);


    // handlers - composed from shared attachment source hooks

    const handleAttachFiles = useAttachHandler_Files(attachAppendFile);
    const handleOpenCamera = useAttachHandler_CameraOpen(attachAppendFile);
    const handleAttachScreenCapture = useAttachHandler_ScreenCapture(attachAppendFile);
    const { openWebInputDialog, webInputDialogComponent } = useAttachHandler_UrlWebLinks(attachAppendUrl);
    const { openGoogleDrivePicker, googleDrivePickerComponent } = useGoogleDrivePicker(attachAppendCloudFile, props.isMobile);

    // viewer render props - same pattern as ComposerAttachmentDraftsList.tsx:44-52
    const renderDocViewer = React.useCallback(
      (part: React.ComponentProps<typeof ViewDocPartModal>['docPart'], onClose: () => void) =>
        <ViewDocPartModal docPart={part} onClose={onClose} />,
      [],
    );

    const renderImageViewer = React.useCallback(
      (part: React.ComponentProps<typeof ViewImageRefPartModal>['imageRefPart'], onClose: () => void) =>
        <ViewImageRefPartModal imageRefPart={part} onClose={onClose} />,
      [],
    );


    return <>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>

        {/* [+] Attachment Sources menu */}
        <AttachmentSourcesMemo
          mode='menu-compact'
          canBrowse={browseCapability.inComposer}
          hasScreenCapture={supportsScreenCapture}
          hasCamera={supportsCameraCapture()}
          onAttachClipboard={attachAppendClipboardItems}
          onAttachFiles={handleAttachFiles}
          onAttachScreenCapture={handleAttachScreenCapture}
          onOpenCamera={handleOpenCamera}
          onOpenGoogleDrivePicker={openGoogleDrivePicker}
          onOpenWebInput={openWebInputDialog}
        />

        {/* Attachment Drafts list */}
        {attachmentDrafts.length > 0 && (
          <AttachmentDraftsList
            attachmentDraftsStoreApi={storeApiRef.current!}
            attachmentDrafts={attachmentDrafts}
            buttonsCanWrap
            renderDocViewer={renderDocViewer}
            renderImageViewer={renderImageViewer}
          />
        )}

      </Box>

      {/* Modal portals */}
      {webInputDialogComponent}
      {googleDrivePickerComponent}

    </>;
  },
);
