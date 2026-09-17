import * as React from 'react';

import { Box, CircularProgress, Dropdown, IconButton, ListDivider, ListItemDecorator, Menu, MenuButton, MenuItem, Sheet, Typography } from '@mui/joy';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { joyKeepPopup } from '~/common/components/CloseablePopup';


export type HostedFileChipBusy = false | 'download' | 'copy' | 'play' | 'delete' | 'inline';

const _styles = {
  sheet: {
    minHeight: '3rem',
    maxWidth: '100%',
    mx: 1.5,
    px: 1.125,
    py: 0.5,
    border: '1px solid',
    borderColor: 'primary.outlinedBorder',
    borderRadius: 'sm',
    boxShadow: 'inset 1px 2px 2px -2px rgba(0, 0, 0, 0.2)',
    display: 'flex',
    alignItems: 'center',
    overflow: 'hidden',
  } as const,
  title: {
    fontSize: 'sm',
    lineHeight: 'sm',
    fontWeight: 'lg',
  } as const,
  subtitle: {
    fontSize: 'xs',
    lineHeight: 'sm',
    opacity: 0.6,
  } as const,
  error: {
    fontSize: 'xs',
    color: 'var(--joy-palette-danger-plainColor)',
  } as const,
  hint: {
    opacity: 0.6,
  } as const,
} as const;


/** Icon button in the chip's action row, with the busy spinner - for vendor actions such as Copy or Play */
export function HostedFileChipButton(props: { title: string; icon: React.ReactNode; busy: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <GoodTooltip title={props.title}>
      <IconButton variant='soft' color='primary' disabled={props.disabled} onClick={props.onClick} size='sm' sx={{ bgcolor: 'transparent' }}>
        {props.busy ? <CircularProgress size='sm' /> : props.icon}
      </IconButton>
    </GoodTooltip>
  );
}


/**
 * Frame and action menu shared by the provider-hosted file chips (Anthropic Files, OpenAI container files, Gemini files).
 * The vendor chips own the data and the handlers; this owns the layout, the busy and error rendering, and the
 * two-step delete confirmed inside the menu.
 */
export function HostedFileChip(props: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tooltip?: string;             // on the text block, for chips without a subtitle
  error?: string | null;        // replaces the subtitle line, in danger color
  busy: HostedFileChipBusy;
  disabled?: boolean;           // every action off, e.g. while metadata loads
  gone?: boolean;               // the provider no longer has the file: only 'Remove from message' remains
  leading?: React.ReactNode;    // vendor buttons before the menu (HostedFileChipButton)
  onCopy?: () => void;          // row button
  onDownload?: () => void;      // row button and menu item
  onInline?: () => void;
  canInline?: boolean;          // with onInline: false greys the item as 'File type not supported'
  menuExtras?: React.ReactNode; // vendor menu items after Inline
  onDelete?: () => void;        // deletes at the provider, then removes the fragment
  deleteFrom?: string;          // provider name on the confirm item, e.g. 'OpenAI'
  onRemove?: () => void;        // removes the fragment only (gone state)
}) {

  const { title, subtitle, tooltip, error, busy, disabled, gone, leading, onCopy, onDownload, onInline, canInline, menuExtras, onDelete, deleteFrom, onRemove } = props;

  // two-step deletion inside the menu: 'Delete' arms, 'Confirm Deletion' acts, closing the menu disarms
  const [deleteArmed, setDeleteArmed] = React.useState(false);
  const handleMenuOpenChange = React.useCallback((_event: unknown, open: boolean) => {
    if (!open) setDeleteArmed(false);
  }, []);
  const handleDeleteConfirmed = React.useCallback(() => {
    if (!deleteArmed) return;
    setDeleteArmed(false);
    onDelete?.();
  }, [deleteArmed, onDelete]);

  const isBusy = !!busy || !!disabled;
  const hasMenu = !!onDownload || !!onInline || !!menuExtras || !!onDelete;

  return (
    <Sheet variant='soft' color='primary' sx={_styles.sheet}>

      <AttachFileRoundedIcon sx={{ fontSize: 'lg', opacity: 0.8 }} />

      <Box sx={{ minWidth: 0, flex: 1, mx: 1 }}>
        <Box className='agi-ellipsize' sx={_styles.title}>
          {tooltip ? <TooltipOutlined title={tooltip} placement='top-start'><span>{title}</span></TooltipOutlined> : title}
        </Box>
        {error ? (
          <Box sx={_styles.error}>
            {error}
          </Box>
        ) : !!subtitle && (
          <Box sx={_styles.subtitle}>
            {subtitle}
          </Box>
        )}
      </Box>

      {gone ? (!!onRemove && (
        <GoodTooltip title='Remove from message'>
          <IconButton variant='plain' color='danger' onClick={onRemove} size='sm' sx={{ bgcolor: 'transparent' }}>
            <DeleteOutlineIcon sx={{ fontSize: 'lg' }} />
          </IconButton>
        </GoodTooltip>
      )) : <>

        {leading}

        {!!onCopy && <HostedFileChipButton title='Copy to clipboard' icon={<ContentCopyIcon sx={{ fontSize: 'lg' }} />} busy={busy === 'copy'} disabled={isBusy} onClick={onCopy} />}
        {!!onDownload && <HostedFileChipButton title='Download file' icon={<DownloadIcon sx={{ fontSize: 'lg' }} />} busy={busy === 'download'} disabled={isBusy} onClick={onDownload} />}

        {hasMenu && (
          <Dropdown onOpenChange={handleMenuOpenChange}>
            <MenuButton slots={{ root: IconButton }} slotProps={{ root: { variant: 'soft', color: 'primary', size: 'sm', disabled: isBusy, sx: { bgcolor: 'transparent' } } }}>
              {(busy === 'inline' || busy === 'delete') ? <CircularProgress size='sm' /> : <MoreVertIcon sx={{ fontSize: 'lg' }} />}
            </MenuButton>
            <Menu placement='bottom-end' sx={{ minWidth: 220 }}>
              {!!onDownload && (
                <MenuItem disabled={isBusy} onClick={onDownload}>
                  <ListItemDecorator><DownloadIcon /></ListItemDecorator>
                  Download
                </MenuItem>
              )}
              {!!onInline && (
                <MenuItem disabled={!canInline || isBusy} onClick={onInline}>
                  <ListItemDecorator><UnfoldMoreIcon /></ListItemDecorator>
                  <div>
                    Embed
                    {!canInline && <Typography level='body-xs' sx={_styles.hint}>File type not supported</Typography>}
                  </div>
                </MenuItem>
              )}
              {menuExtras}
              {!!onDelete && <ListDivider />}
              {!!onDelete && (!deleteArmed ? (
                <MenuItem color='danger' disabled={isBusy} onClick={joyKeepPopup(() => setDeleteArmed(true)) /* keep open to show the confirm step */}>
                  <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
                  Delete
                </MenuItem>
              ) : <>
                <MenuItem onClick={joyKeepPopup(() => setDeleteArmed(false))}>
                  <ListItemDecorator><CloseRoundedIcon /></ListItemDecorator>
                  Cancel
                </MenuItem>
                <MenuItem color='danger' disabled={isBusy} onClick={handleDeleteConfirmed}>
                  <ListItemDecorator><DeleteForeverIcon /></ListItemDecorator>
                  {deleteFrom ? `Delete from ${deleteFrom}` : 'Confirm Deletion'}
                </MenuItem>
              </>)}
            </Menu>
          </Dropdown>
        )}

      </>}
    </Sheet>
  );
}
