import * as React from 'react';

import { Box, IconButton, ListItemDecorator, MenuItem } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';

import type { AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import type { AttachmentDraftsStoreApi } from '~/common/attachment-drafts/store-attachment-drafts-slice';

import type { LLMAttachments } from './useLLMAttachments';
import { LLMAttachmentItem } from './LLMAttachmentItem';
import { LLMAttachmentMenu } from './LLMAttachmentMenu';


/**
 * Renderer of attachment drafts, with menus, etc.
 */
export function LLMAttachmentsList(props: {
  attachmentDraftsStoreApi: AttachmentDraftsStoreApi,
  llmAttachments: LLMAttachments,

  onAttachmentDraftInlineText: (attachmentDraftId: AttachmentDraftId) => void,
  onAttachmentDraftsInlineText: () => void,
}) {

  // state
  const [confirmClearAttachmentDrafts, setConfirmClearAttachmentDrafts] = React.useState<boolean>(false);
  const [itemMenu, setItemMenu] = React.useState<{ anchor: HTMLAnchorElement, attachmentDraftId: AttachmentDraftId } | null>(null);
  const [overallMenuAnchor, setOverallMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // derived state
  const { llmAttachments, onAttachmentDraftInlineText, onAttachmentDraftsInlineText } = props;

  const { attachments, isOutputTextInlineable } = llmAttachments;

  const hasAttachments = attachments.length >= 1;

  // derived item menu state

  const itemMenuAnchor = itemMenu?.anchor;
  const itemMenuAttachmentDraftId = itemMenu?.attachmentDraftId;
  const itemMenuAttachment = itemMenuAttachmentDraftId ? attachments.find(la => la.attachmentDraft.id === itemMenu.attachmentDraftId) : undefined;
  const itemMenuIndex = itemMenuAttachment ? attachments.indexOf(itemMenuAttachment) : -1;


  // item menu

  const handleItemMenuToggle = React.useCallback((attachmentDraftId: AttachmentDraftId, anchor: HTMLAnchorElement) => {
    handleOverallMenuHide();
    setItemMenu(prev => prev?.attachmentDraftId === attachmentDraftId ? null : { anchor, attachmentDraftId });
  }, []);

  const handleItemMenuHide = React.useCallback(() => {
    setItemMenu(null);
  }, []);


  // item menu operations

  const handleAttachmentDraftInlineText = React.useCallback((attachmentDraftId: string) => {
    handleItemMenuHide();
    onAttachmentDraftInlineText(attachmentDraftId);
  }, [handleItemMenuHide, onAttachmentDraftInlineText]);


  // menu

  const handleOverallMenuHide = () => setOverallMenuAnchor(null);

  const handleOverallMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setOverallMenuAnchor(anchor => anchor ? null : event.currentTarget);
  };


  // overall operations

  const handleAttachmentDraftsInlineText = React.useCallback(() => {
    handleOverallMenuHide();
    onAttachmentDraftsInlineText();
  }, [onAttachmentDraftsInlineText]);

  const handleClearAttachmentDrafts = () => setConfirmClearAttachmentDrafts(true);

  const handleClearAttachmentDraftsConfirmed = React.useCallback(() => {
    handleOverallMenuHide();
    setConfirmClearAttachmentDrafts(false);
    props.attachmentDraftsStoreApi.getState().clearAttachmentsDrafts();
  }, [props.attachmentDraftsStoreApi]);


  // no components without attachments
  if (!hasAttachments)
    return null;

  return <>

    {/* Attachment Drafts bar */}
    <Box sx={{ position: 'relative' }}>

      {/* Horizontally scrollable Attachments */}
      <Box sx={{ display: 'flex', overflowX: 'auto', gap: 1, height: '100%', pr: 5 }}>
        {attachments.map((llmAttachment) =>
          <LLMAttachmentItem
            key={llmAttachment.attachmentDraft.id}
            llmAttachment={llmAttachment}
            menuShown={llmAttachment.attachmentDraft.id === itemMenuAttachmentDraftId}
            onItemMenuToggle={handleItemMenuToggle}
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


    {/* LLM Attachment Draft Menu */}
    {!!itemMenuAnchor && !!itemMenuAttachment && !!props.attachmentDraftsStoreApi && (
      <LLMAttachmentMenu
        attachmentDraftsStoreApi={props.attachmentDraftsStoreApi}
        llmAttachment={itemMenuAttachment}
        menuAnchor={itemMenuAnchor}
        isPositionFirst={itemMenuIndex === 0}
        isPositionLast={itemMenuIndex === attachments.length - 1}
        onAttachmentDraftInlineText={handleAttachmentDraftInlineText}
        onClose={handleItemMenuHide}
      />
    )}


    {/* Overall Menu */}
    {!!overallMenuAnchor && (
      <CloseableMenu
        dense placement='top-start'
        open anchorEl={overallMenuAnchor} onClose={handleOverallMenuHide}
      >
        <MenuItem onClick={handleAttachmentDraftsInlineText} disabled={!isOutputTextInlineable}>
          <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
          Inline <span style={{ opacity: 0.5 }}>text attachments</span>
        </MenuItem>
        <MenuItem onClick={handleClearAttachmentDrafts}>
          <ListItemDecorator><ClearIcon /></ListItemDecorator>
          Clear{attachments.length > 5 ? <span style={{ opacity: 0.5 }}> {attachments.length} attachments</span> : null}
        </MenuItem>
      </CloseableMenu>
    )}

    {/* 'Clear' Confirmation */}
    {confirmClearAttachmentDrafts && (
      <ConfirmationModal
        open onClose={() => setConfirmClearAttachmentDrafts(false)} onPositive={handleClearAttachmentDraftsConfirmed}
        title='Confirm Removal'
        positiveActionText='Remove All'
        confirmationText={`This action will remove all (${attachments.length}) attachments. Do you want to proceed?`}
      />
    )}

  </>;
}