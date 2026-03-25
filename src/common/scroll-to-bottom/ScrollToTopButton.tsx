import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { IconButton } from '@mui/joy';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';

import { themeZIndexBeamView } from '~/common/app.theme';

import { useScrollToBottom } from './useScrollToBottom';


export function getScrollToTopButtonSx(): SxProps {
  return {
    backgroundColor: 'background.surface',
    border: '1px solid',
    borderColor: 'neutral.500',
    borderRadius: '50%',
    boxShadow: 'sm',
    zIndex: themeZIndexBeamView + 1,
    position: 'absolute',
    top: '1rem',
    right: {
      xs: '1rem',
      md: '2rem',
    },
  } as const;
}

export function ScrollToTopButton() {

  const { atTop, stickToBottom, scrollToTop } = useScrollToBottom();

  if (atTop !== false && !stickToBottom)
    return null;

  return (
    <IconButton
      aria-label='Scroll To Top'
      variant='plain'
      onClick={scrollToTop}
      sx={getScrollToTopButtonSx()}
    >
      <KeyboardDoubleArrowUpIcon sx={{ fontSize: 'xl' }} />
    </IconButton>
  );
}
