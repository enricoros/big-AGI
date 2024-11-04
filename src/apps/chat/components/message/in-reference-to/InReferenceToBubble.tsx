import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Tooltip, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';

import type { DMetaReferenceItem } from '~/common/stores/chat/chat.message';


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

export const inlineMessageBubbleSx: SxProps = {
  ...bubbleComposerSx,

  // redefine
  // border: 'none',
  // mt: 1,
  borderColor: `${INLINE_COLOR}.outlinedColor`, // outlinedBorder:lighter, outlinedColor:darker
  borderRadius: 'sm',
  boxShadow: 'xs',
  // boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-primary-outlinedColor)',
  width: undefined,
  padding: '0.375rem 0.25rem 0.375rem 0.5rem',

  // FORMERLY: self-layout (parent: 'block', as 'grid' was not working and the user would scroll the app on the x-axis on mobile)
  // float: 'inline-end',
  // mr: { xs: 7.75, md: 10.5 }, // personaSx.minWidth + gap (md: 1) + 1.5 (text margin)

  // now: the parent is a 'grid' to v-layout fragment types
  // mx: '0.75rem', // 1.5, like margin of text blocks
  ml: 'auto', // right-align the bubble in the parent

};


export function InReferenceToBubble(props: {
  item: DMetaReferenceItem,
  onRemove?: (item: DMetaReferenceItem) => void,
  className?: string,
  bubbleVariant?: 'message',
}) {

  // derived state

  const variantMessage = props.bubbleVariant === 'message';

  // handlers

  const { onRemove } = props;

  const handleRemoveClicked = React.useCallback(() => {
    onRemove?.(props.item);
  }, [onRemove, props.item]);

  return (
    <Box className={props.className} sx={!variantMessage ? bubbleComposerSx : inlineMessageBubbleSx}>

      <Tooltip disableInteractive arrow title='Referring to this assistant text' placement='top'>
        <ReplyRoundedIcon sx={{
          color: variantMessage ? `${INLINE_COLOR}.outlinedColor` : 'primary.solidBg',
          fontSize: 'xl',
          mt: 0.125,
          transform: props.item.mRole === 'assistant' ? undefined : 'rotate(105deg)',
        }} />
      </Tooltip>

      <Typography level='body-sm' sx={{
        flex: 1,
        ml: 1,
        mr: variantMessage ? 1 : 0.5,
        overflow: 'auto',
        maxHeight: variantMessage ? '8rem' : '5.75rem',
        lineHeight: 'xl',
        color: variantMessage ? 'primary.softActiveColor' : 'text.secondary',
        whiteSpace: 'break-spaces', // 'balance'
      }}>
        {props.item.mText}
      </Typography>

      {!!props.onRemove && (
        <IconButton size='sm' onClick={handleRemoveClicked} sx={{ my: -0.5, background: 'none' }}>
          <CloseRoundedIcon />
        </IconButton>
      )}

    </Box>
  );
}