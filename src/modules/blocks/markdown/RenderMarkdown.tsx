import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, styled } from '@mui/joy';

import { lineHeightChatTextMd } from '~/common/app.theme';

import CustomMarkdownRenderer from './CustomMarkdownRenderer';


/*
 * Markdown is bundled in the main chunk (not lazy-loaded) because:
 * - It's used immediately when opening any conversation with existing messages
 * - Lazy loading caused a visible "Loading..." flash on the critical path
 * - The ~150KB cost is acceptable for instant rendering of this core feature
 */

/*
 * For performance reasons, we style this component here and copy the equivalent of 'props.sx' (the lineHeight) locally.
 */
const RenderMarkdownBox = styled(Box)({
  // same look as the other RenderComponents
  marginInline: '0.75rem !important',                             // margin: 1.5 like other blocks
  // this is here for usage outside of the Blocks (which set it in `sx`)
  lineHeight: lineHeightChatTextMd,

  // patch the CSS
  // fontFamily: `inherit !important`,                    // (not needed anymore, as CSS is under our control) use the default font family
  // '--color-canvas-default': 'transparent !important',  // (not needed anymore) remove the default background color
  '& table': { width: 'inherit !important' },           // un-break auto-width (tables have 'max-content', which overflows)
});


export function RenderMarkdown(props: { content: string; disablePreprocessor?: boolean, sx?: SxProps; }) {
  return (
    <RenderMarkdownBox
      className='markdown-body' /* NOTE: see GithubMarkdown.css for the dark/light switch, synced with Joy's */
      sx={props.sx}
    >
      <CustomMarkdownRenderer content={props.content} disablePreprocessor={props.disablePreprocessor} />
    </RenderMarkdownBox>
  );
}

export const RenderMarkdownMemo = React.memo(RenderMarkdown);
