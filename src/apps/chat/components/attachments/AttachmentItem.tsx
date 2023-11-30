import * as React from 'react';

import { Box, Button, CircularProgress, ColorPaletteProp, Divider, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { GoodTooltip } from '~/common/components/GoodTooltip';

import type { Attachment } from './attachment.types';


export function AttachmentItem(props: {
  attachment: Attachment,
  onAttachmentRemove: (attachmentId: string) => void
}) {

  // state
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // derived state
  const { attachment, onAttachmentRemove } = props;

  const isLoading = attachment.sourceLoading;
  const isError = !!attachment.sourceError;

  // menu

  const handleMenuHide = () => setMenuAnchor(null);

  const handleMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) =>
    setMenuAnchor(anchor => anchor ? null : event.currentTarget);


  // operations

  const handleRemoveAttachment = React.useCallback(() => {
    handleMenuHide();
    onAttachmentRemove(attachment.id);
  }, [onAttachmentRemove, attachment.id]);

  const tooltip = isError ? attachment.sourceError : isLoading ? 'Loading' : null;
  const variant = isError ? 'soft' : isLoading ? 'outlined' : 'soft';
  const color: ColorPaletteProp = isError ? 'danger' : isLoading ? 'success' : 'neutral';


  return <Box>

    <GoodTooltip title={tooltip} isError={isError}>
      <Button
        variant={variant} color={color} size='sm'
        onClick={handleMenuToggle}
        sx={{
          borderRadius: 'xs',
          flexDirection: 'column',
          fontWeight: 'normal',
          minWidth: 64,
          px: 1, py: 0.5,
        }}
      >
        {isLoading && <CircularProgress color='success' />}

        {!isLoading && props.attachment.source.type}

        {!isLoading && <Typography level='body-xs'>
          {/*{props.attachment.label}*/}
          {props.attachment.inputs.map(input => input.mimeType + ': ' + input.data.length.toLocaleString())}
          {props.attachment.output?.outputType}
        </Typography>}

      </Button>
    </GoodTooltip>

    {/* Item Menu */}
    {!!menuAnchor && (
      <CloseableMenu
        placement='top' sx={{ minWidth: 200 }}
        open anchorEl={menuAnchor} onClose={handleMenuHide}
      >
        <MenuItem disabled>
          Type ...
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleRemoveAttachment}>
          <ListItemDecorator><ClearIcon /></ListItemDecorator>
          Remove
        </MenuItem>
      </CloseableMenu>
    )}

  </Box>;
}