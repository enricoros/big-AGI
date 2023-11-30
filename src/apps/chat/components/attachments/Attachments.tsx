import * as React from 'react';

import { Box, IconButton, ListItemDecorator, MenuItem } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';

import { Attachment } from './attachment.types';
import { AttachmentItem } from './AttachmentItem';


/**
 * Renderer of attachments, with menus, etc.
 */
export function Attachments(props: {
  attachments: Attachment[]
  onAttachmentsClear: () => void,
  onAttachmentsInline: () => void,
  onAttachmentRemove: (attachmentId: string) => void
}) {

  // state
  const [confirmClearAttachments, setConfirmClearAttachments] = React.useState<boolean>(false);
  const [overallMenuAnchor, setOverallMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // derive state
  const { attachments, onAttachmentsClear, onAttachmentsInline, onAttachmentRemove } = props;
  const hasAttachments = attachments.length >= 1;


  // menu

  const handleOverallMenuHide = () => setOverallMenuAnchor(null);

  const handleOverallMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) =>
    setOverallMenuAnchor(anchor => anchor ? null : event.currentTarget);


  // individual operations

  const handleRemoveAttachment = React.useCallback((attachmentId: string) => {
    onAttachmentRemove(attachmentId);
  }, [onAttachmentRemove]);


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

  // no components without attachments
  if (!hasAttachments)
    return null;

  return <>

    {/* Attachments bar */}
    <Box sx={{ display: 'flex', gap: 1 }}>

      {/* Overall Menu button */}
      <IconButton variant='soft' color='neutral' size='sm' onClick={handleOverallMenuToggle} sx={{ borderRadius: 'xs' }}>
        <ExpandLessIcon />
      </IconButton>

      {/* Horizontally scrollable Attachments */}
      <Box sx={{ display: 'flex', overflowX: 'auto', gap: 1 }}>
        {attachments.map(attachment =>
          <AttachmentItem
            key={attachment.id}
            attachment={attachment}
            onAttachmentRemove={handleRemoveAttachment}
          />,
        )}
      </Box>

    </Box>

    {/* Menu */}
    {!!overallMenuAnchor && (
      <CloseableMenu
        placement='top-start'
        open anchorEl={overallMenuAnchor} onClose={handleOverallMenuHide}
      >
        <MenuItem disabled onClick={handleInlineAttachments}>
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