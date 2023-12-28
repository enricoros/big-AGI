import * as React from 'react';

import { IconButton, Tooltip, Typography } from '@mui/joy';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

import { useScrollToBottom } from './useScrollToBottom';


export function ScrollToBottomButton() {

  // state
  const { atBottom, stickToBottom, stuckToBottom } = useScrollToBottom();

  // do not render the button at all if we're already snapping
  if (atBottom || stuckToBottom)
    return null;

  return (
    <Tooltip title={
      <Typography variant='solid' level='title-sm' sx={{ px: 1 }}>
        Scroll to bottom
      </Typography>
    }>
      <IconButton
        variant='outlined' color='primary'
        onClick={stickToBottom}
        sx={{
          // place this on the bottom-right corner (FAB-like)
          position: 'absolute',
          bottom: '2rem',
          right: {
            xs: '1rem',
            md: '2rem',
          },

          // style it
          backgroundColor: 'background.surface',
          borderRadius: '50%',
          boxShadow: 'sm',

          // fade it in when hovering
          transition: 'all 0.15s',
          '&:hover': {
            transform: 'scale(1.1)',
          },
        }}
      >
        <ArrowDropDownIcon />
      </IconButton>
    </Tooltip>
  );
}