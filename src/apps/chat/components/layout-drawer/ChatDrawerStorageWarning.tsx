import * as React from 'react';

import { Box, Button, ColorPaletteProp, Divider, IconButton, Input, Link, ModalClose, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import { GoodModal } from '~/common/components/modals/GoodModal';

import { useChatStorageWarning } from '../../store-app-chat';


// the exact phrase the user must type to permanently dismiss the warning
const CONFIRMATION_PHRASE = 'I understand';
const COLOR: ColorPaletteProp = 'primary';


const _styles = {
  banner: {
    flexShrink: 0,
    position: 'relative',
    display: 'flex',
    alignItems: 'start',
    gap: 1,
    m: 1,
    // p: 1,
    // mx: 1.5,
    // my: 1,
    pl: 1,
    py: 0.75,
    pr: 2.25,
    color: `${COLOR}.softColor`,
    backgroundColor: `${COLOR}.softBg`,
    borderRadius: 'sm',
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    transform: 'translate(0.25rem, -0.25rem)',
    minWidth: '1.5rem',
    minHeight: '1.5rem',
    // borderRadius: '50%',
    borderRadius: 'sm',
    // boxShadow: 'xs',
    backgroundColor: `${COLOR}.softHoverBg`,
    '&:hover': {
      backgroundColor: `${COLOR}.solidBg`,
      color: `${COLOR}.solidColor`,
    },
  },

  // modal: same visual family as the Activation dialog
  modalDialog: {
    minWidth: { xs: 340, sm: 420, md: 480 },
    maxWidth: 480,
    p: 'calc(var(--Card-padding) * 2)',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  headline: {
    fontSize: { xs: '1.25rem', sm: '1.5rem' },
  },
  block: {
    mt: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5,
  },
  footnote: {
    textAlign: 'center',
    color: 'text.tertiary',
    pb: 0.5,
  },
} as const;


function isPhraseMatch(input: string): boolean {
  return input.trim().toLowerCase() === CONFIRMATION_PHRASE.toLowerCase();
}


/**
 * Small warning banner shown at the bottom of the chat list, alerting the user that chats live
 * only in this browser and are lost when the browser cache/data is cleared (issue #672).
 *
 * Dismissal requires typing 'I understand', and is persisted to the app-chat store, so it won't
 * show again - up to a cache clear, which wipes all app data (the very event this warns about).
 *
 * Note: the cloud/sync build (`dev`, Pro offering) backs chats up to a server and survives cache
 * clears; there this banner is hidden for backed-up users and gains Upgrade-to-Pro paths.
 */
export function ChatDrawerStorageWarning() {

  // state
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  // external state
  const [dismissed, dismissStorageWarning] = useChatStorageWarning();


  const handleConfirm = React.useCallback(() => {
    dismissStorageWarning();
    setConfirmOpen(false);
  }, [dismissStorageWarning]);


  if (dismissed) return null;

  return <>

    {/* Warning Banner */}
    <Box sx={_styles.banner}>
      {/*<WarningRoundedIcon sx={{ color: `${COLOR}.solidBg`, fontSize: 'lg', mt: 0.125, flexShrink: 0 }} />*/}
      <Typography level='body-xs' sx={{ color: 'inherit' }}>
        Chats are saved only in this browser.{' '}
        Export important chats to keep a backup.
        {/*<b>Export</b> regularly to keep a backup.*/}
        {/*{' '}<Link*/}
        {/*  component='button'*/}
        {/*  level='body-xs'*/}
        {/*  onClick={() => setConfirmOpen(true)}*/}
        {/*>*/}
        {/*  Close*/}
        {/*</Link>*/}
      </Typography>

      {/* Close 'x': soft, rounded, overflowing the top-right corner */}
      <IconButton
        aria-label='Dismiss storage warning'
        size='sm'
        color={COLOR}
        variant='soft'
        onClick={() => setConfirmOpen(true)}
        sx={_styles.closeButton}
      >
        <CloseRoundedIcon sx={{ fontSize: 'md' }} />
      </IconButton>
    </Box>

    {/* Confirmation Modal */}
    {confirmOpen && (
      <StorageWarningConfirmationModal
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
      />
    )}

  </>;
}


function StorageWarningConfirmationModal(props: {
  onClose: () => void;
  onConfirm: () => void;
}) {

  // state
  const [userInput, setUserInput] = React.useState('');

  const isConfirmed = isPhraseMatch(userInput);


  return (
    <GoodModal
      open
      noTitleBar
      hideBottomClose
      darkerBackdrop
      onClose={props.onClose}
      sx={_styles.modalDialog}
    >
      <ModalClose aria-label='Close storage warning' onClick={props.onClose} />

      {/* Header */}
      <Box sx={_styles.header}>
        <Typography level='h2' sx={_styles.headline}>
          Data is stored in this browser
        </Typography>
      </Box>

      {/* Messages */}
      <Box sx={_styles.block}>
        <Box fontSize='sm'>
          Big-AGI is a local-first app that saves your data and settings in this browser - private by default.
        </Box>
        <Box fontSize='sm'>
          <b>Clearing the browser cache or data will erase chats and settings permanently.</b>
        </Box>
        <Box fontSize='sm'>
          There is no server copy: use <b>Export</b> periodically to back up important chats.
        </Box>

        {/* Typed friction dismissal */}
        <Box>
          <Box sx={{ fontSize: 'sm', mb: 1 }}>
            To dismiss this notice, type <Box component='span' sx={{ fontWeight: 'bold', color: 'primary.softColor' }}>&quot;{CONFIRMATION_PHRASE}&quot;</Box>:
          </Box>
          <Input
            // color='warning'
            // autoFocus
            placeholder={CONFIRMATION_PHRASE}
            value={userInput}
            onChange={(event) => setUserInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && isConfirmed)
                props.onConfirm();
            }}
          />
          <Button
            // size='lg'
            // color='neutral'
            variant='soft'
            fullWidth
            disabled={!isConfirmed}
            onClick={props.onConfirm}
            sx={{ mt: 1 }}
          >
            Continue without backup
          </Button>
        </Box>
      </Box>

      {/* Footer Note */}
      {/*<Typography level='body-xs' sx={_styles.footnote}>*/}
      {/*  For your security, API keys are never uploaded or synced.*/}
      {/*</Typography>*/}

    </GoodModal>
  );
}
