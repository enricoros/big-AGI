import * as React from 'react';

import { Box, IconButton, Tooltip, Typography } from '@mui/joy';

import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';


export function BubbleReplyTo(props: { replyToText: string | null, onClick: () => void }) {
  return (
    <Box sx={{
      backgroundColor: 'background.popup',
      p: 1,
      pr: 0.5,
      border: '1px solid',
      borderColor: 'neutral.outlinedBorder',
      borderRadius: 'xl',
      borderTopLeftRadius: 0,
      display: 'flex', alignItems: 'start',
    }}>
      <Tooltip disableInteractive arrow title='Replying to the assistant text' placement='top'>
        <ReplyRoundedIcon sx={{ color: 'primary.solidBg', fontSize: 'xl' }} />
      </Tooltip>
      <Typography level='body-sm' sx={{
        flex: 1,
        ml: 1, mr: 0.5,
        overflow: 'auto',
        maxHeight: '7.5rem',
        lineHeight: 'xl',
        color: 'text.secondary',
        whiteSpace: 'break-spaces', // 'balance'
      }}>
        {props.replyToText}
      </Typography>
      <IconButton size='sm' onClick={props.onClick} sx={{ my: -0.5, background: 'none' }}>
        <CloseRoundedIcon />
      </IconButton>
    </Box>
  );
}