import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Divider, Sheet } from '@mui/joy';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { useBrowseCapability } from '~/modules/browse/store-module-browsing';

import type { DMessageFragmentId } from '~/common/stores/chat/chat.fragments';
import { AttachmentDraftsList } from '~/common/attachment-drafts/attachment-drafts-ui/AttachmentDraftsList';
import { AttachmentSourcesMemo } from '~/common/attachment-drafts/attachment-sources/AttachmentSources';
import { createAttachmentDraftsVanillaStore } from '~/common/attachment-drafts/store-attachment-drafts_vanilla';
import { supportsCameraCapture } from '~/common/components/camera/useCameraCapture';
import { supportsScreenCapture } from '~/common/util/screenCaptureUtils';
import { useAttachHandler_CameraOpen, useAttachHandler_Files, useAttachHandler_ScreenCapture, useAttachHandler_UrlWebLinks } from '~/common/attachment-drafts/attachment-sources/useAttachmentSourceHandlers';
import { useAttachmentDrafts } from '~/common/attachment-drafts/useAttachmentDrafts';
import { useGoogleDrivePicker } from '~/common/attachment-drafts/attachment-sources/useGoogleDrivePicker';

import type { CMEditDrafts } from './cmEditDrafts';


/** The edit-mode frame, like the text editor boxes: the end bar and the attachments editor share it. */
export const cmEditFrameSx: SxProps = {
  overflow: 'hidden',
  p: 0.5,
  boxShadow: 'inset 1px 0px 3px -2px var(--joy-palette-warning-softColor)',
  outline: '1px solid',
  outlineColor: 'var(--joy-palette-warning-solidBg)',
  borderRadius: 'sm',
  // shade to the draft buttons inside this > div > div > button
  '& > div > div > button': {
    borderColor: 'warning.outlinedBorder',
    borderRadius: 'sm',
    boxShadow: 'sm',
  },
} as const;

const _styles = {

  // the bar at the end
  bar: {
    ...cmEditFrameSx,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1,
  },

  // the row below an attachments group
  group: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1,
  },

  // same as the Attach menu button
  textButton: {
    minHeight: '2.25rem',
    m: -0.25,
  },

} as const satisfies Record<string, SxProps>;


/**
 * Edit mode add control, in two places: the bar at the end of the message (a new text block, new attachments) and
 * the row below each attachments group (attachments into that group). Owns a drafts store, registered with the
 * session's `CMEditDrafts` under its anchor; Insert takes the drafts into the copy now, else Done takes them.
 * Without `drafts`, text only.
 */
export function CMEditAttach(props: {
  variant: 'bar' | 'group',
  drafts?: CMEditDrafts,
  anchorRef?: React.RefObject<DMessageFragmentId | null>, // the fragment the drafts follow at Done; none: the end
  isMobile: boolean,
  onAddText?: () => void,
}) {

  // the drafts store, owned here; the session takes from it through the registry
  const [store] = React.useState(createAttachmentDraftsVanillaStore);
  const { drafts, anchorRef } = props;
  React.useEffect(() => {
    if (!drafts) return;
    const unregister = drafts.register(store, () => anchorRef?.current ?? null);
    return () => {
      unregister();
      store.getState().removeAllAttachmentDrafts(); // a control that goes away takes its drafts with it
    };
  }, [anchorRef, drafts, store]);

  // external state
  const { attachmentDrafts, attachAppendClipboardItems, attachAppendCloudFile, attachAppendFile, attachAppendUrl } = useAttachmentDrafts(store, false, false, undefined, false);
  const browseCapability = useBrowseCapability();

  // handlers - composed from shared attachment source hooks
  const handleAttachFiles = useAttachHandler_Files(attachAppendFile);
  const handleOpenCamera = useAttachHandler_CameraOpen(attachAppendFile);
  const handleAttachScreenCapture = useAttachHandler_ScreenCapture(attachAppendFile);
  const { openWebInputDialog, webInputDialogComponent } = useAttachHandler_UrlWebLinks(attachAppendUrl);
  const { openGoogleDrivePicker, googleDrivePickerComponent } = useGoogleDrivePicker(attachAppendCloudFile, props.isMobile);


  // drafts still loading or converting: Insert waits
  const draftsBusy = attachmentDrafts.some(draft => draft.inputLoading || draft.outputsConverting);

  const handleInsert = React.useCallback(() => {
    void drafts?.takeStore(store);
  }, [drafts, store]);


  const sources = !drafts ? null : (
    <AttachmentSourcesMemo
      mode='menu-message'
      menuButtonLabel={props.variant === 'group' ? 'Add' : undefined}
      canBrowse={browseCapability.mayWork}
      hasScreenCapture={supportsScreenCapture}
      hasCamera={supportsCameraCapture()}
      onAttachClipboard={attachAppendClipboardItems}
      onAttachFiles={handleAttachFiles}
      onAttachScreenCapture={handleAttachScreenCapture}
      onOpenCamera={handleOpenCamera}
      onOpenGoogleDrivePicker={openGoogleDrivePicker}
      onOpenWebInput={openWebInputDialog}
    />
  );

  const list = !attachmentDrafts.length ? null : <>
    <AttachmentDraftsList
      attachmentDraftsStoreApi={store}
      attachmentDrafts={attachmentDrafts}
      buttonsCanWrap
    />
    <Button size='sm' variant='solid' color='warning' disabled={draftsBusy} startDecorator={<CheckRoundedIcon />} onClick={handleInsert} sx={_styles.textButton}>
      Insert
    </Button>
  </>;

  const modals = <>
    {webInputDialogComponent}
    {googleDrivePickerComponent}
  </>;

  if (props.variant === 'group')
    return <>
      <Divider sx={{ my: 1 }} />
      <Box sx={_styles.group}>
        {sources}
        {list}
      </Box>
      {modals}
    </>;

  return <>
    <Sheet color='warning' variant='soft' sx={_styles.bar}>
      {!!props.onAddText && (
        <Button size='sm' variant='soft' color='warning' startDecorator={<AddRoundedIcon />} onClick={props.onAddText} sx={_styles.textButton}>
          Text
        </Button>
      )}
      {sources}
      {list}
    </Sheet>
    {modals}
  </>;
}
