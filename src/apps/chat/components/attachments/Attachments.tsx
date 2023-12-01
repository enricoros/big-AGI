import * as React from 'react';

import { Box, IconButton, ListItemDecorator, MenuItem } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';

import type { Attachment } from './store-attachments';
import { AttachmentItem } from './AttachmentItem';


/**
 * Renderer of attachments, with menus, etc.
 */
export function Attachments(props: {
  attachments: Attachment[]
  onAttachmentsClear: () => void,
  onAttachmentsInline: () => void,
}) {

  // state
  const [confirmClearAttachments, setConfirmClearAttachments] = React.useState<boolean>(false);
  const [overallMenuAnchor, setOverallMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // derive state
  const { attachments, onAttachmentsClear, onAttachmentsInline } = props;
  const hasAttachments = attachments.length >= 1;


  // menu

  const handleOverallMenuHide = () => setOverallMenuAnchor(null);

  const handleOverallMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) =>
    setOverallMenuAnchor(anchor => anchor ? null : event.currentTarget);


  // overall operations

  const handleInlineAttachments = React.useCallback(() => {
    handleOverallMenuHide();
    onAttachmentsInline();
  }, [onAttachmentsInline]);

  const handleClearAttachments = () => setConfirmClearAttachments(true);

  const handleClearAttachmentsConfirmed = React.useCallback(() => {
    handleOverallMenuHide();
    setConfirmClearAttachments(false);
    onAttachmentsClear();
  }, [onAttachmentsClear]);


  // individual operations

  const handleAttachmentInline = React.useCallback((attachmentId: string) => {
    // (attachmentId);
    console.log('Not implemented: handleAttachmentInline', attachmentId);
  }, []);


  // no components without attachments
  if (!hasAttachments)
    return null;

  return <>

    {/* Attachments bar */}
    <Box sx={{ position: 'relative' }}>

      {/* Horizontally scrollable Attachments */}
      <Box sx={{ display: 'flex', overflowX: 'auto', gap: 1, height: '100%', pr: 5 }}>
        {attachments.map((attachment, idx) =>
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            isPositionFirst={idx === 0}
            isPositionLast={idx === attachments.length - 1}
            onAttachmentInline={handleAttachmentInline}
          />,
        )}
      </Box>

      {/* Overall Menu button */}
      <IconButton
        variant='plain' onClick={handleOverallMenuToggle}
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

    {/* Menu */}
    {!!overallMenuAnchor && (
      <CloseableMenu
        placement='top-start'
        open anchorEl={overallMenuAnchor} onClose={handleOverallMenuHide}
        noTopPadding noBottomPadding
      >
        <MenuItem onClick={handleInlineAttachments}>
          <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
          Inline <span style={{ opacity: 0.5 }}>attachments</span>
        </MenuItem>
        <MenuItem onClick={handleClearAttachments}>
          <ListItemDecorator><ClearIcon /></ListItemDecorator>
          Clear
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