import * as React from 'react';

import { Button, Divider, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';

import { Attachment } from './attachment.types';
import { CloseableMenu } from '~/common/components/CloseableMenu';


export function AttachmentItem(props: {
  attachment: Attachment,
  onAttachmentRemove: (attachmentId: string) => void
}) {

  // state
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // derived state
  const { attachment: { id: attachmendId }, onAttachmentRemove } = props;


  // menu

  const handleMenuHide = () => setMenuAnchor(null);

  const handleMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) =>
    setMenuAnchor(anchor => anchor ? null : event.currentTarget);


  // operations

  const handleRemoveAttachment = React.useCallback(() => {
    handleMenuHide();
    onAttachmentRemove(attachmendId);
  }, [onAttachmentRemove, attachmendId]);


  return (

    <Button
      variant='soft' color='neutral' size='sm'
      onClick={handleMenuToggle}
      sx={{
        borderRadius: 'xs',
        flexDirection: 'column',
        fontWeight: 'normal',
        px: 1, py: 0.5,
      }}
    >

      <Typography level='title-sm'>
        {props.attachment.source.type}
      </Typography>

      <Typography level='body-xs'>
        {props.attachment.id} {props.attachment.label} {props.attachment.input?.mimeType} {props.attachment.output?.outputType}
      </Typography>

      {/* Item Menu */}
      {!!menuAnchor && (
        <CloseableMenu
          placement='top' sx={{ minWidth: 200 }}
          open anchorEl={menuAnchor} onClose={handleMenuHide}
        >
          <MenuItem>
            aa
          </MenuItem>
          <MenuItem>
            aa
          </MenuItem>
          <Divider />
          <MenuItem>
            aa
          </MenuItem>
          <MenuItem onClick={handleRemoveAttachment}>
            <ListItemDecorator><ClearIcon /></ListItemDecorator>
            Remove
          </MenuItem>
        </CloseableMenu>
      )}

      {/*{open && <CloseableMenu open anchorEl={} onClose={}}*/}

    </Button>

  );
}