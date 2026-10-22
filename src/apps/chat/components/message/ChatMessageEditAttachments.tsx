import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Sheet } from '@mui/joy';

import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts_slice';
import { AttachmentDraftsList } from '~/common/attachment-drafts/attachment-drafts-ui/AttachmentDraftsList';
import { AttachmentSourcesMemo } from '~/common/attachment-drafts/attachment-sources/AttachmentSources';
import { useAttachHandler_CameraOpen, useAttachHandler_Files, useAttachHandler_ScreenCapture, useAttachHandler_UrlWebLinks } from '~/common/attachment-drafts/attachment-sources/useAttachmentSourceHandlers';
import { supportsCameraCapture } from '~/common/components/camera/useCameraCapture';
import { supportsScreenCapture } from '~/common/util/screenCaptureUtils';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useGoogleDrivePicker } from '~/common/attachment-drafts/attachment-sources/useGoogleDrivePicker';

import { ViewDocPartModal } from './fragments-content/ViewDocPartModal';
import { ViewImageRefPartModal } from './fragments-content/ViewImageRefPartModal';


const _styles = {
  box: {
    overflow: 'hidden',
    p: 0.5,

    // looks - exactly from BoxTextArea - the Text editor
    boxShadow: 'inset 1px 0px 3px -2px var(--joy-palette-warning-softColor)',
    outline: '1px solid',
    outlineColor: 'var(--joy-palette-warning-solidBg)',
    borderRadius: 'sm',

    // layout
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1,

    // shade to the buttons inside this > div > div > button
    '& > div > div > button': {
      // backgroundColor: 'warning.softActiveBg',
      borderColor: 'warning.outlinedBorder',
      borderRadius: 'sm',
      boxShadow: 'sm',
    },
  },
} as const satisfies Record<string, SxProps>;


/**
 * Encapsulates all attachment wiring for ChatMessage edit mode, over the edit session's drafts store
 * (the session takes the drafts at Done and disposes the store).
 */
export const ChatMessageEditAttachments = React.memo(
  function ChatMessageEditAttachments(props: { attachmentDraftsStoreApi: AttachmentDraftsStoreApi, isMobile: boolean }) {

    // external state
    const {
      attachmentDrafts,
      attachAppendClipboardItems, attachAppendCloudFile, attachAppendFile, attachAppendUrl, // attachAppendDataTransfer
    } = useAttachmentDrafts(props.attachmentDraftsStoreApi, false, false, undefined, false);
    const browseCapability = useBrowseCapability();


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

      <Sheet color='warning' variant='soft' sx={_styles.box}>

        {/* [+] Attachment Sources menu */}
        <AttachmentSourcesMemo
          mode='menu-message'
          canBrowse={browseCapability.mayWork}
          hasScreenCapture={supportsScreenCapture}
          hasCamera={supportsCameraCapture()}
          // onlyImages={showAttachOnlyImages}
          onAttachClipboard={attachAppendClipboardItems}
          onAttachFiles={handleAttachFiles}
          onAttachScreenCapture={handleAttachScreenCapture}
          onOpenCamera={handleOpenCamera}
          onOpenGoogleDrivePicker={openGoogleDrivePicker}
          onOpenWebInput={openWebInputDialog}
        />

        {/* Attachment Drafts list */}
        {attachmentDrafts.length > 0 ? (
          <AttachmentDraftsList
            attachmentDraftsStoreApi={props.attachmentDraftsStoreApi}
            attachmentDrafts={attachmentDrafts}
            buttonsCanWrap
            renderDocViewer={renderDocViewer}
            renderImageViewer={renderImageViewer}
          />
        ) : null}

      </Sheet>

      {/* Modal portals */}
      {webInputDialogComponent}
      {googleDrivePickerComponent}

    </>;
  },
);
