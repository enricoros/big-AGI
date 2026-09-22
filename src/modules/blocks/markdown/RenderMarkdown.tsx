import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, styled } from '@mui/joy';

import { lineHeightChatTextMd } from '~/common/app.theme';


export interface RenderMarkdownRendererProps {
  content: string;

  /**
   * Optional flag to disable the markdown preprocessor. Useful for progressive
   * messages that are being rendered.
   *
   * OK: Very safe for Highlight/Strikeout.
   * MEH: A little loss for progressive rendering of inline formulas, but those regex are
   * extremely expensive and it's not worth to keep re-running them at every new input token.
   */
  disablePreprocessor?: boolean;

  /**
   * Optionals function to enable interactive rendering of the markdown.
   * @param currentContent shall be equal to content
   * @param newContent the new markdown to put in place of the current content
   */
  replaceContent?: (currentContent: string, newContent: string) => void;
}


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


const DynamicMarkdownRenderer = React.lazy(() => import('./CustomMarkdownRenderer'));

export function RenderMarkdown(props: RenderMarkdownRendererProps & { sx?: SxProps }) {
  const { sx, ...rendererProps } = props;
  return (
    <RenderMarkdownBox
      // NOTE: we moved the `className='markdown-body'` to the CustomMarkdownRenderer, as we have an extra div,
      // which would require to change CSS rules
      // className='markdown-body' /* NOTE: see GithubMarkdown.css for the dark/light switch, synced with Joy's */
      sx={props.sx}
    >
      <React.Suspense fallback={<div>Loading...</div>}>
        <DynamicMarkdownRenderer {...rendererProps} />
      </React.Suspense>
    </RenderMarkdownBox>
  );
}

export const RenderMarkdownMemo = React.memo(RenderMarkdown);
