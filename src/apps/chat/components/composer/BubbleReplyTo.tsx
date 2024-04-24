import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Tooltip, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';


const bubbleComposerSx: SxProps = {
  // contained
  width: '100%',
  zIndex: 2, // stays on top of the 'tokens' bubble in the composer

  // style
  backgroundColor: 'background.surface',
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'sm',
  boxShadow: 'xs',
  padding: '0.5rem 0.25rem 0.5rem 0.5rem',

  // layout
  display: 'flex',
  alignItems: 'start',
};


export function BubbleReplyTo(props: {
  replyToText: string | null,
  onClear: () => void
  className?: string,
}) {
  return (
    <Box className={props.className} sx={bubbleComposerSx}>
      <Tooltip disableInteractive arrow title='Replying to the assistant text' placement='top'>
        <ReplyRoundedIcon sx={{ color: 'primary.solidBg', fontSize: 'xl', mt: 0.125 }} />
      </Tooltip>
      <Typography level='body-sm' sx={{
        flex: 1,
        ml: 1,
        mr: 0.5,
        overflow: 'auto',
        maxHeight: '5.75rem',
        lineHeight: 'xl',
        color: 'text.secondary',
        whiteSpace: 'break-spaces', // 'balance'
      }}>
        {props.replyToText}
      </Typography>
      <IconButton size='sm' onClick={props.onClear} sx={{ my: -0.5, background: 'none' }}>
        <CloseRoundedIcon />
      </IconButton>
    </Box>
  );
}