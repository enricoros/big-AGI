import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Button, IconButton, List, ListItem, ListItemContent, ListItemDecorator, Tooltip, Typography } from '@mui/joy';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteGoIcon from '@mui/icons-material/ContentPasteGo';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import HistoryIcon from '@mui/icons-material/History';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { copyToClipboard, getClipboardItems, supportsClipboardRead } from '~/common/util/clipboardUtils';

import { ClipboardHistoryItem, scratchClipActions, useScratchClipHistory } from './store-scratchclip';


// configuration
const MAX_DISPLAY_LENGTH = 100; // and still will be ellipsized


export function ScratchClip() {

  // external state
  const { history, isVisible } = useScratchClipHistory();


  // handlers

  const handleClose = React.useCallback(() => {
    scratchClipActions().setClipboardVisibility(false);
  }, []);

  const handleRestoreSnippet = React.useCallback((item: ClipboardHistoryItem, event: React.MouseEvent) => {
    event.stopPropagation();
    copyToClipboard(item.text, 'Snippet from history');
    // addSnackbar({ message: 'Snippet restored to clipboard.', type: 'success', key: 'clip-restore' });
    // Optionally close after restore: handleClose();
  }, []);

  const handleRemoveSnippet = React.useCallback((id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    scratchClipActions().removeSnippet(id);
  }, []);

  const handleClearHistory = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    scratchClipActions().clearHistory();
    addSnackbar({ message: 'Clipboard history cleared.', type: 'info', key: 'clip-clear' });
  }, []);

  const handleReadClipboard = React.useCallback(async () => {
    const clipboardItems = await getClipboardItems();

    if (!clipboardItems || clipboardItems.length === 0) {
      addSnackbar({ key: 'clipboard-issue', type: 'issue', message: 'Clipboard empty or access denied', overrides: { autoHideDuration: 2000, } });
      return;
    }

    // Process clipboard items
    for (const item of clipboardItems) {
      const types = item.types;

      // Try to get text content
      if (types.includes('text/plain')) {
        try {
          const blob = await item.getType('text/plain');
          const text = await blob.text();

          if (text.trim()) {
            scratchClipActions().addSnippet(text);
            addSnackbar({ message: 'Added clipboard content to history', type: 'success', key: 'clip-read-success' });
          }
        } catch (error) {
          console.warn('Failed to read clipboard text:', error);
        }
      }
    }
  }, []);


  // conditional rendering
  // if (!isVisible) return null;


  return (
    <GoodModal
      open={isVisible}
      onClose={handleClose}
      titleStartDecorator={<HistoryIcon />}
      unfilterBackdrop
      title={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

          {/* Title */}
          <Typography>
            Clipboard History
          </Typography>

          {/* Clear Button */}
          {history.length > 0 && (
            <Tooltip title='Clear All History' variant='solid' placement='bottom'>
              <IconButton size='sm' variant='plain' color='neutral' onClick={handleClearHistory} sx={{ mr: 1 }}>
                <ClearAllIcon />
              </IconButton>
            </Tooltip>
          )}

        </Box>
      }
      startButton={!supportsClipboardRead() ? undefined : (
        <Button
          variant='soft'
          color='neutral'
          startDecorator={<ContentPasteGoIcon />}
          onClick={handleReadClipboard}
        >
          Add from Clipboard
        </Button>
      )}
      sx={{ animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.07,1.14,.85,1.02)` }}
    >

      {/* Content */}
      {!history.length ? (
        <Typography sx={{ p: 3, textAlign: 'center' }}>
          Local clipboard history is empty.
        </Typography>
      ) : (
        <List
          variant='outlined'
          sx={{
            p: 0,
            borderRadius: 'md',
            boxShadow: 'lg',
            overflowY: 'auto',

            // items looks
            '& > li': {
              borderRadius: '0px',
              py: 1,
            },
            '& > li:not(:last-child)': {
              borderBottom: '1px solid',
              borderColor: 'divider',
            },
          }}
        >
          {history.map((item) => (
            <ListItem key={item.id}>

              {/* > Copy */}
              <ListItemDecorator>
                <Tooltip title='Copy to Clipboard' variant='outlined' placement='left'>
                  <IconButton
                    size='sm'
                    // color='primary'
                    onClick={(e) => handleRestoreSnippet(item, e)}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </ListItemDecorator>

              {/* > Preview */}
              <ListItemContent sx={{ overflow: 'hidden' }}>
                <Typography level='body-sm' noWrap textColor='text.secondary'>
                  {item.text.length > MAX_DISPLAY_LENGTH ? item.text.substring(0, MAX_DISPLAY_LENGTH) + '...' : item.text}
                </Typography>
                <Typography level='body-xs'>
                  <TimeAgo date={item.timestamp} />
                  {/*{item.source && <Box component='span' color='text.tertiary'> · from {item.source}</Box>}*/}
                </Typography>
              </ListItemContent>

              {/* > Delete */}
              <IconButton
                size='sm'
                // color='danger'
                onClick={(e) => handleRemoveSnippet(item.id, e)}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </ListItem>
          ))}
        </List>
      )}

    </GoodModal>
  );
}
