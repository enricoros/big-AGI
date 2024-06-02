import * as React from 'react';

import { Box, IconButton, ListItemDecorator, MenuItem } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';

import type { AttachmentId } from './store-attachments';
import type { LLMAttachments } from './useLLMAttachments';
import { AttachmentItem } from './AttachmentItem';
import { AttachmentMenu } from './AttachmentMenu';


/**
 * Renderer of attachments, with menus, etc.
 */
export function Attachments(props: {
  llmAttachments: LLMAttachments,
  onAttachmentInlineText: (attachmentId: AttachmentId) => void,
  onAttachmentsClear: () => void,
  onAttachmentsInlineText: () => void,
}) {

  // state
  const [confirmClearAttachments, setConfirmClearAttachments] = React.useState<boolean>(false);
  const [itemMenu, setItemMenu] = React.useState<{ anchor: HTMLAnchorElement, attachmentId: AttachmentId } | null>(null);
  const [overallMenuAnchor, setOverallMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // derived state
  const { llmAttachments, onAttachmentsClear, onAttachmentInlineText, onAttachmentsInlineText } = props;

  const { attachments, isOutputTextInlineable } = llmAttachments;

  const hasAttachments = attachments.length >= 1;

  // derived item menu state

  const itemMenuAnchor = itemMenu?.anchor;
  const itemMenuAttachmentId = itemMenu?.attachmentId;
  const itemMenuAttachment = itemMenuAttachmentId ? attachments.find(la => la.attachment.id === itemMenu.attachmentId) : undefined;
  const itemMenuIndex = itemMenuAttachment ? attachments.indexOf(itemMenuAttachment) : -1;


  // item menu

  const handleItemMenuToggle = React.useCallback((attachmentId: AttachmentId, anchor: HTMLAnchorElement) => {
    handleOverallMenuHide();
    setItemMenu(prev => prev?.attachmentId === attachmentId ? null : { anchor, attachmentId });
  }, []);

  const handleItemMenuHide = React.useCallback(() => {
    setItemMenu(null);
  }, []);


  // item menu operations

  const handleAttachmentInlineText = React.useCallback((attachmentId: string) => {
    handleItemMenuHide();
    onAttachmentInlineText(attachmentId);
  }, [handleItemMenuHide, onAttachmentInlineText]);


  // menu

  const handleOverallMenuHide = () => setOverallMenuAnchor(null);

  const handleOverallMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setOverallMenuAnchor(anchor => anchor ? null : event.currentTarget);
  };


  // overall operations

  const handleAttachmentsInlineText = React.useCallback(() => {
    handleOverallMenuHide();
    onAttachmentsInlineText();
  }, [onAttachmentsInlineText]);

  const handleClearAttachments = () => setConfirmClearAttachments(true);

  const handleClearAttachmentsConfirmed = React.useCallback(() => {
    handleOverallMenuHide();
    setConfirmClearAttachments(false);
    onAttachmentsClear();
  }, [onAttachmentsClear]);


  // no components without attachments
  if (!hasAttachments)
    return null;

  return <>

    {/* Attachments bar */}
    <Box sx={{ position: 'relative' }}>

      {/* Horizontally scrollable Attachments */}
      <Box sx={{ display: 'flex', overflowX: 'auto', gap: 1, height: '100%', pr: 5 }}>
        {attachments.map((llmAttachment) =>
          <AttachmentItem
            key={llmAttachment.attachment.id}
            llmAttachment={llmAttachment}
            menuShown={llmAttachment.attachment.id === itemMenuAttachmentId}
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


    {/* Attachment Menu */}
    {!!itemMenuAnchor && !!itemMenuAttachment && (
      <AttachmentMenu
        llmAttachment={itemMenuAttachment}
        menuAnchor={itemMenuAnchor}
        isPositionFirst={itemMenuIndex === 0}
        isPositionLast={itemMenuIndex === attachments.length - 1}
        onAttachmentInlineText={handleAttachmentInlineText}
        onClose={handleItemMenuHide}
      />
    )}


    {/* Overall Menu */}
    {!!overallMenuAnchor && (
      <CloseableMenu
        dense placement='top-start'
        open anchorEl={overallMenuAnchor} onClose={handleOverallMenuHide}
      >
        <MenuItem onClick={handleAttachmentsInlineText} disabled={!isOutputTextInlineable}>
          <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
          Inline <span style={{ opacity: 0.5 }}>text attachments</span>
        </MenuItem>
        <MenuItem onClick={handleClearAttachments}>
          <ListItemDecorator><ClearIcon /></ListItemDecorator>
          Clear{attachments.length > 5 ? <span style={{ opacity: 0.5 }}> {attachments.length} attachments</span> : null}
        </MenuItem>
      </CloseableMenu>
    )}

    {/* 'Clear' Confirmation */}
    {confirmClearAttachments && (
      <ConfirmationModal
        open onClose={() => setConfirmClearAttachments(false)} onPositive={handleClearAttachmentsConfirmed}
        title='Confirm Removal'
        positiveActionText='Remove All'
        confirmationText={`This action will remove all (${attachments.length}) attachments. Do you want to proceed?`}
      />
    )}

  </>;
}