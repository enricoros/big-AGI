import * as React from 'react';

import { Box, IconButton, ListDivider, ListItemDecorator, MenuItem } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import type { DMessageDocPart, DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import type { AttachmentDraft, AttachmentDraftId, AttachmentDraftsAction } from '../attachment.types';
import type { AttachmentDraftsStoreApi } from '../store-attachment-drafts_slice';
import type { AttachmentEnrichmentSummary, IAttachmentEnrichment } from '../llm-enrichment/attachment.enrichment';

import { AttachmentDraftButtonMemo } from './AttachmentDraftButton';
import { AttachmentDraftMenu } from './AttachmentDraftMenu';


const _style = {

  bar: {
    position: 'relative',
  } as const,

  barScrollX: {
    height: '100%',
    pr: 5,
    overflowX: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
  } as const,

  barWraps: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 1,
  } as const,

  barMenuButton: {
    // borderRadius: 'sm',
    borderRadius: 0,
    position: 'absolute', right: 0, top: 0,
    backgroundColor: 'neutral.softDisabledBg',
  } as const,

} as const;


/**
 * Generic renderer of attachment drafts, with menus, etc.
 * Portable across Composer, ChatMessage edit, FollowUps, etc.
 */
export function AttachmentDraftsList(props: {
  attachmentDraftsStoreApi: AttachmentDraftsStoreApi,
  attachmentDrafts: AttachmentDraft[],
  enrichment?: IAttachmentEnrichment,
  enrichmentSummary?: AttachmentEnrichmentSummary,
  buttonsCanWrap?: boolean,
  onAttachmentDraftsAction?: (attachmentDraftId: AttachmentDraftId | null, actionId: AttachmentDraftsAction) => void,
  // optional rendering props
  startDecorator?: React.ReactNode,
  renderDocViewer?: (docPart: DMessageDocPart, onClose: () => void) => React.ReactNode,
  renderImageViewer?: (imageRefPart: DMessageImageRefPart, onClose: () => void) => React.ReactNode,
  renderOverallMenuExtra?: () => React.ReactNode,
}) {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const [draftMenu, setDraftMenu] = React.useState<{ anchor: HTMLAnchorElement, attachmentDraftId: AttachmentDraftId } | null>(null);
  const [overallMenuAnchor, setOverallMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);
  const [viewerDocPart, setViewerDocPart] = React.useState<DMessageDocPart | null>(null);
  const [viewerImageRefPart, setViewerImageRefPart] = React.useState<DMessageImageRefPart | null>(null);

  // derived state

  const { attachmentDrafts, enrichmentSummary } = props;
  const canInlineSomeFragments = enrichmentSummary?.anyInlinable ?? false;
  const hasAttachments = attachmentDrafts.length >= 1;

  // ref to optimize
  const attachmentDraftsRef = React.useRef(attachmentDrafts);
  attachmentDraftsRef.current = attachmentDrafts;

  // derived item menu state

  const itemMenuAnchor = draftMenu?.anchor;
  const itemMenuAttachmentDraftId = draftMenu?.attachmentDraftId;
  const itemMenuAttachmentDraft = itemMenuAttachmentDraftId ? attachmentDrafts.find(a => a.id === draftMenu.attachmentDraftId) : undefined;
  const itemMenuIndex = itemMenuAttachmentDraft ? attachmentDrafts.indexOf(itemMenuAttachmentDraft) : -1;


  // overall menu

  const { onAttachmentDraftsAction } = props;

  const handleOverallMenuHide = React.useCallback(() => setOverallMenuAnchor(null), []);

  const handleOverallMenuToggle = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.shiftKey && console.log('llmAttachmentDrafts', attachmentDraftsRef.current);
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setOverallMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, []);

  const handleOverallCopyText = React.useCallback(() => {
    handleOverallMenuHide();
    onAttachmentDraftsAction?.(null, 'copy-text');
  }, [handleOverallMenuHide, onAttachmentDraftsAction]);

  const handleOverallInlineText = React.useCallback(() => {
    handleOverallMenuHide();
    onAttachmentDraftsAction?.(null, 'inline-text');
  }, [handleOverallMenuHide, onAttachmentDraftsAction]);

  const handleOverallClear = React.useCallback(async () => {
    if (await showPromisedOverlay('chat-attachments-clear', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        title='Confirm Removal'
        positiveActionText='Remove All'
        confirmationText={`This action will remove all (${attachmentDraftsRef.current.length}) attachments. Do you want to proceed?`}
      />,
    )) {
      handleOverallMenuHide();
      props.attachmentDraftsStoreApi.getState().removeAllAttachmentDrafts();
    }
  }, [handleOverallMenuHide, props.attachmentDraftsStoreApi, showPromisedOverlay]);


  // item menu

  const handleDraftMenuHide = React.useCallback(() => setDraftMenu(null), []);

  const handleDraftMenuToggle = React.useCallback((attachmentDraftId: AttachmentDraftId, anchor: HTMLAnchorElement) => {
    handleOverallMenuHide();
    setDraftMenu(prev => prev?.attachmentDraftId === attachmentDraftId ? null : { anchor, attachmentDraftId });
  }, [handleOverallMenuHide]);

  const handleDraftAction = React.useCallback((attachmentDraftId: AttachmentDraftId, actionId: AttachmentDraftsAction) => {
    // pass-through, but close the menu as well, as the action is destructive for the caller
    handleDraftMenuHide();
    onAttachmentDraftsAction?.(attachmentDraftId, actionId);
  }, [handleDraftMenuHide, onAttachmentDraftsAction]);

  const handleViewImageRefPart = React.useCallback((imageRefPart: DMessageImageRefPart) => {
    setViewerImageRefPart(imageRefPart);
  }, []);

  const handleCloseImageViewer = React.useCallback(() => {
    setViewerImageRefPart(null);
  }, []);

  const handleViewDocPart = React.useCallback((docPart: DMessageDocPart) => {
    setViewerDocPart(docPart);
  }, []);

  const handleCloseDocPartViewer = React.useCallback(() => {
    setViewerDocPart(null);
  }, []);


  // no components without attachments
  if (!hasAttachments)
    return null;

  return <>

    {/* Attachment Drafts bar */}
    <Box sx={_style.bar}>

      {/* Horizontally scrollable */}
      <Box sx={!props.buttonsCanWrap ? _style.barScrollX : _style.barWraps}>

        {/* Slot: before buttons (e.g. AI Suggestion Button) */}
        {props.startDecorator}

        {/* Attachment Buttons */}
        {attachmentDrafts.map((draft) =>
          <AttachmentDraftButtonMemo
            key={draft.id}
            draft={draft}
            enrichment={props.enrichment}
            menuShown={draft.id === itemMenuAttachmentDraftId}
            onToggleMenu={handleDraftMenuToggle}
            onViewImageRefPart={!props.renderImageViewer ? undefined : handleViewImageRefPart}
          />,
        )}

      </Box>

      {/* Overall Menu button */}
      {!props.buttonsCanWrap && (
        <IconButton
          onClick={handleOverallMenuToggle}
          onContextMenu={handleOverallMenuToggle}
          sx={_style.barMenuButton}
        >
          <ExpandLessIcon />
        </IconButton>
      )}

    </Box>


    {/* Image Viewer Modal - when opening attachment images */}
    {!!viewerImageRefPart && props.renderImageViewer?.(viewerImageRefPart, handleCloseImageViewer)}

    {/* Text Viewer Modal */}
    {!!viewerDocPart && props.renderDocViewer?.(viewerDocPart, handleCloseDocPartViewer)}


    {/* Single Attachment Draft Menu */}
    {!!itemMenuAnchor && !!itemMenuAttachmentDraft && !!props.attachmentDraftsStoreApi && (
      <AttachmentDraftMenu
        attachmentDraftsStoreApi={props.attachmentDraftsStoreApi}
        draft={itemMenuAttachmentDraft}
        enrichment={props.enrichment}
        menuAnchor={itemMenuAnchor}
        isPositionFirst={itemMenuIndex === 0}
        isPositionLast={itemMenuIndex === attachmentDrafts.length - 1}
        onClose={handleDraftMenuHide}
        onDraftAction={!onAttachmentDraftsAction ? undefined : handleDraftAction}
        onViewDocPart={!props.renderDocViewer ? undefined : handleViewDocPart}
        onViewImageRefPart={!props.renderImageViewer ? undefined : handleViewImageRefPart}
      />
    )}


    {/* All Drafts Menu */}
    {!!overallMenuAnchor && (
      <CloseablePopup
        menu anchorEl={overallMenuAnchor} onClose={handleOverallMenuHide}
        dense
        minWidth={200}
        placement='top-start'
      >
        {/* Slot: extra overall menu items (e.g. "What can I do?") */}
        {props.renderOverallMenuExtra?.()}

        {!!onAttachmentDraftsAction && <MenuItem onClick={handleOverallInlineText} disabled={!canInlineSomeFragments}>
          <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
          Inline all text
        </MenuItem>}
        {!!onAttachmentDraftsAction && <MenuItem onClick={handleOverallCopyText} disabled={!canInlineSomeFragments}>
          <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
          Copy all text
        </MenuItem>}
        {!!onAttachmentDraftsAction && <ListDivider />}

        <MenuItem onClick={handleOverallClear}>
          <ListItemDecorator><ClearIcon /></ListItemDecorator>
          Remove All{attachmentDrafts.length > 5 ? <span style={{ opacity: 0.5 }}> {attachmentDrafts.length} attachments</span> : null}
        </MenuItem>
      </CloseablePopup>
    )}

  </>;
}
