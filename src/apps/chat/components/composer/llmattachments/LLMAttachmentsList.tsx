import * as React from 'react';

import { Box, CircularProgress, IconButton, ListDivider, ListItemDecorator, MenuItem } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ClearIcon from '@mui/icons-material/Clear';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import type { AgiAttachmentPromptsData } from '~/modules/aifn/agiattachmentprompts/useAgiAttachmentPrompts';

import { CloseablePopup } from '~/common/components/CloseablePopup';
import { ConfirmationModal } from '~/common/components/modals/ConfirmationModal';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import type { AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-perchat-attachment-drafts_slice';
import type { DMessageDocPart, DMessageImageRefPart } from '~/common/stores/chat/chat.fragments';

import { ViewImageRefPartModal } from '../../message/fragments-content/ViewImageRefPartModal';

import type { LLMAttachmentDraft } from './useLLMAttachmentDrafts';
import { LLMAttachmentButtonMemo } from './LLMAttachmentButton';
import { LLMAttachmentMenu } from './LLMAttachmentMenu';
import { LLMAttachmentsPromptsButtonMemo } from './LLMAttachmentsPromptsButton';
import { ViewDocPartModal } from '../../message/fragments-content/ViewDocPartModal';


export type LLMAttachmentDraftsAction = 'inline-text' | 'copy-text';


/**
 * Renderer of attachment drafts, with menus, etc.
 */
export function LLMAttachmentsList(props: {
  agiAttachmentPrompts: AgiAttachmentPromptsData
  attachmentDraftsStoreApi: AttachmentDraftsStoreApi,
  canInlineSomeFragments: boolean,
  llmAttachmentDrafts: LLMAttachmentDraft[],
  onAttachmentDraftsAction: (attachmentDraftId: AttachmentDraftId | null, actionId: LLMAttachmentDraftsAction) => void,
}) {

  // state
  const { showPromisedOverlay } = useOverlayComponents();
  const [draftMenu, setDraftMenu] = React.useState<{ anchor: HTMLAnchorElement, attachmentDraftId: AttachmentDraftId } | null>(null);
  const [overallMenuAnchor, setOverallMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);
  const [viewerDocPart, setViewerDocPart] = React.useState<DMessageDocPart | null>(null);
  const [viewerImageRefPart, setViewerImageRefPart] = React.useState<DMessageImageRefPart | null>(null);

  // derived state

  const { agiAttachmentPrompts, canInlineSomeFragments, llmAttachmentDrafts } = props;
  const hasAttachments = llmAttachmentDrafts.length >= 1;

  // derived item menu state

  const itemMenuAnchor = draftMenu?.anchor;
  const itemMenuAttachmentDraftId = draftMenu?.attachmentDraftId;
  const itemMenuAttachmentDraft = itemMenuAttachmentDraftId ? llmAttachmentDrafts.find(la => la.attachmentDraft.id === draftMenu.attachmentDraftId) : undefined;
  const itemMenuIndex = itemMenuAttachmentDraft ? llmAttachmentDrafts.indexOf(itemMenuAttachmentDraft) : -1;


  // overall menu

  const { onAttachmentDraftsAction } = props;

  const handleOverallMenuHide = React.useCallback(() => setOverallMenuAnchor(null), []);

  const handleOverallMenuToggle = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.shiftKey && console.log('llmAttachmentDrafts', llmAttachmentDrafts);
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setOverallMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, [llmAttachmentDrafts]);

  const handleOverallCopyText = React.useCallback(() => {
    handleOverallMenuHide();
    onAttachmentDraftsAction(null, 'copy-text');
  }, [handleOverallMenuHide, onAttachmentDraftsAction]);

  const handleOverallInlineText = React.useCallback(() => {
    handleOverallMenuHide();
    onAttachmentDraftsAction(null, 'inline-text');
  }, [handleOverallMenuHide, onAttachmentDraftsAction]);

  const handleOverallClear = React.useCallback(async () => {
    if (await showPromisedOverlay('chat-attachments-clear', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <ConfirmationModal
        open onClose={onUserReject} onPositive={() => onResolve(true)}
        title='Confirm Removal'
        positiveActionText='Remove All'
        confirmationText={`This action will remove all (${llmAttachmentDrafts.length}) attachments. Do you want to proceed?`}
      />,
    )) {
      handleOverallMenuHide();
      props.attachmentDraftsStoreApi.getState().removeAllAttachmentDrafts();
    }
  }, [handleOverallMenuHide, llmAttachmentDrafts.length, props.attachmentDraftsStoreApi, showPromisedOverlay]);


  // item menu

  const handleDraftMenuHide = React.useCallback(() => setDraftMenu(null), []);

  const handleDraftMenuToggle = React.useCallback((attachmentDraftId: AttachmentDraftId, anchor: HTMLAnchorElement) => {
    handleOverallMenuHide();
    setDraftMenu(prev => prev?.attachmentDraftId === attachmentDraftId ? null : { anchor, attachmentDraftId });
  }, [handleOverallMenuHide]);

  const handleDraftAction = React.useCallback((attachmentDraftId: AttachmentDraftId, actionId: LLMAttachmentDraftsAction) => {
    // pass-through, but close the menu as well, as the action is destructive for the caller
    handleDraftMenuHide();
    onAttachmentDraftsAction(attachmentDraftId, actionId);
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
    <Box sx={{ position: 'relative' }}>

      {/* Horizontally scrollable */}
      <Box sx={{ height: '100%', pr: 5, overflowX: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>

        {/* AI Suggestion Button */}
        {(agiAttachmentPrompts.isVisible || agiAttachmentPrompts.hasData) && (
          <LLMAttachmentsPromptsButtonMemo data={agiAttachmentPrompts} />
        )}

        {/* Attachment Buttons */}
        {llmAttachmentDrafts.map((llmAttachment) =>
          <LLMAttachmentButtonMemo
            key={llmAttachment.attachmentDraft.id}
            llmAttachment={llmAttachment}
            menuShown={llmAttachment.attachmentDraft.id === itemMenuAttachmentDraftId}
            onToggleMenu={handleDraftMenuToggle}
            onViewImageRefPart={handleViewImageRefPart}
          />,
        )}

      </Box>

      {/* Overall Menu button */}
      <IconButton
        onClick={handleOverallMenuToggle}
        onContextMenu={handleOverallMenuToggle}
        sx={{
          // borderRadius: 'sm',
          borderRadius: 0,
          position: 'absolute', right: 0, top: 0,
          backgroundColor: 'neutral.softDisabledBg',
        }}
      >
        <ExpandLessIcon />
      </IconButton>

    </Box>


    {/* Image Viewer Modal - when opening attachment images */}
    {!!viewerImageRefPart && (
      <ViewImageRefPartModal imageRefPart={viewerImageRefPart} onClose={handleCloseImageViewer} />
    )}

    {/* Text Viewer Modal */}
    {!!viewerDocPart && (
      <ViewDocPartModal docPart={viewerDocPart} onClose={handleCloseDocPartViewer} />
    )}


    {/* Single LLM Attachment Draft Menu */}
    {!!itemMenuAnchor && !!itemMenuAttachmentDraft && !!props.attachmentDraftsStoreApi && (
      <LLMAttachmentMenu
        attachmentDraftsStoreApi={props.attachmentDraftsStoreApi}
        llmAttachmentDraft={itemMenuAttachmentDraft}
        menuAnchor={itemMenuAnchor}
        isPositionFirst={itemMenuIndex === 0}
        isPositionLast={itemMenuIndex === llmAttachmentDrafts.length - 1}
        onClose={handleDraftMenuHide}
        onDraftAction={handleDraftAction}
        onViewDocPart={handleViewDocPart}
        onViewImageRefPart={handleViewImageRefPart}
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
        {/* uses the agiAttachmentPrompts to imagine what the user will ask aboud those */}
        <MenuItem color='primary' variant='soft' onClick={agiAttachmentPrompts.refetch} disabled={!hasAttachments || agiAttachmentPrompts.isFetching}>
          <ListItemDecorator>{agiAttachmentPrompts.isFetching ? <CircularProgress size='sm' /> : <AutoFixHighIcon />}</ListItemDecorator>
          What can I do?
        </MenuItem>

        <ListDivider />

        <MenuItem onClick={handleOverallInlineText} disabled={!canInlineSomeFragments}>
          <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
          Inline all text
        </MenuItem>
        <MenuItem onClick={handleOverallCopyText} disabled={!canInlineSomeFragments}>
          <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
          Copy all text
        </MenuItem>

        <ListDivider />

        <MenuItem onClick={handleOverallClear}>
          <ListItemDecorator><ClearIcon /></ListItemDecorator>
          Remove All{llmAttachmentDrafts.length > 5 ? <span style={{ opacity: 0.5 }}> {llmAttachmentDrafts.length} attachments</span> : null}
        </MenuItem>
      </CloseablePopup>
    )}

  </>;
}