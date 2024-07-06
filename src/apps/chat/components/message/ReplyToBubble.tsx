import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Tooltip, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';


// configuration
const INLINE_COLOR = 'primary';


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

const inlineMessageSx: SxProps = {
  ...bubbleComposerSx,

  // redefine
  // border: 'none',
  mt: 1,
  borderColor: `${INLINE_COLOR}.outlinedColor`,
  borderRadius: 'sm',
  boxShadow: 'xs',
  width: undefined,
  padding: '0.375rem 0.25rem 0.375rem 0.5rem',

  // self-layout (parent: 'block', as 'grid' was not working and the user would scroll the app on the x-axis on mobile)
  // ml: 'auto',
  float: 'inline-end',
  mr: { xs: 7.75, md: 10.5 }, // personaSx.minWidth + gap (md: 1) + 1.5 (text margin)

};


export function ReplyToBubble(props: {
  replyToText: string | null,
  inlineMessage?: boolean
  onClear?: () => void,
  className?: string,
}) {
  return (
    <Box className={props.className} sx={!props.inlineMessage ? bubbleComposerSx : inlineMessageSx}>
      <Tooltip disableInteractive arrow title='Referring to this assistant text' placement='top'>
        <ReplyRoundedIcon sx={{
          color: props.inlineMessage ? `${INLINE_COLOR}.outlinedColor` : 'primary.solidBg',
          fontSize: 'xl',
          mt: 0.125,
        }} />
      </Tooltip>
      <Typography level='body-sm' sx={{
        flex: 1,
        ml: 1,
        mr: 0.5,
        overflow: 'auto',
        maxHeight: '5.75rem',
        lineHeight: 'xl',
        color: /*props.inlineMessage ? 'text.tertiary' :*/ 'text.secondary',
        whiteSpace: 'break-spaces', // 'balance'
      }}>
        {props.replyToText}
      </Typography>
      {!!props.onClear && (
        <IconButton size='sm' onClick={props.onClear} sx={{ my: -0.5, background: 'none' }}>
          <CloseRoundedIcon />
        </IconButton>
      )}
    </Box>
  );
}