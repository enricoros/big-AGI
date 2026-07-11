import * as React from 'react';

import { Box, Button, ColorPaletteProp, Divider, IconButton, Input, Link, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

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
    pr: 1.75,
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
 * clears, so there this banner is suppressed (gated on an active sync where it's rendered).
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
        Your chats and settings are saved only locally in this browser. Wiping the browser cache or data erases them permanently.
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
      title='Dismiss storage warning?'
      titleStartDecorator={<WarningRoundedIcon sx={{ color: 'warning.solidBg' }} />}
      onClose={props.onClose}
      hideBottomClose
    >
      <Divider />

      <Typography level='body-md'>
        Your chats and settings live <b>only in this browser</b>. Clearing the browser cache or data
        permanently erases everything - there is no server copy on this version.
      </Typography>
      <Typography level='body-md'>
        Use <b>Export</b> to back up your chats and settings before clearing anything.
      </Typography>

      <Typography level='body-sm' sx={{ mt: 1 }}>
        Type <Typography component='span' fontWeight='lg' color='warning'>&quot;{CONFIRMATION_PHRASE}&quot;</Typography> to hide this warning:
      </Typography>
      <Input
        autoFocus
        placeholder={CONFIRMATION_PHRASE}
        value={userInput}
        onChange={(event) => setUserInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && isConfirmed)
            props.onConfirm();
        }}
      />

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1 }}>
        <Button variant='plain' color='neutral' onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant='solid' color='warning' disabled={!isConfirmed} onClick={props.onConfirm}>
          Hide warning
        </Button>
      </Box>
    </GoodModal>
  );
}
