import * as React from 'react';

import { Box, styled } from '@mui/joy';

import { lineHeightChatText } from '~/common/app.theme';

import type { TextBlock } from './blocks';


/*
 * For performance reasons, we style this component here and copy the equivalent of 'props.sx' (the lineHeight) locally.
 */
const RenderMarkdownBox = styled(Box)({
  // same look as the other RenderComponents
  marginInline: '0.75rem !important',                             // margin: 1.5 like other blocks
  lineHeight: lineHeightChatText,

  // patch the CSS
  // fontFamily: `inherit !important`,                    // (not needed anymore, as CSS is under our control) use the default font family
  // '--color-canvas-default': 'transparent !important',  // (not needed anymore) remove the default background color
  '& table': { width: 'inherit !important' },           // un-break auto-width (tables have 'max-content', which overflows)
});


// Dynamically import ReactMarkdown using React.lazy
const DynamicReactGFM = React.lazy(async () => {
  const [markdownModule, remarkGfmModule] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);

  // NOTE: extracted here instead of inline as a large performance optimization
  const remarkPlugins = [remarkGfmModule.default];

  // Pass the dynamically imported remarkGfm as children
  const ReactMarkdownWithRemarkGfm = (props: any) =>
    <markdownModule.default remarkPlugins={remarkPlugins} {...props} />;

  return { default: ReactMarkdownWithRemarkGfm };
});


export const RenderMarkdown = (props: { textBlock: TextBlock }) => {
  return (
    <RenderMarkdownBox className='markdown-body' /* NODE: see GithubMarkdown.css for the dark/light switch, synced with Joy's */ >
      <React.Suspense fallback={<div>Loading...</div>}>
        <DynamicReactGFM>
          {props.textBlock.content}
        </DynamicReactGFM>
      </React.Suspense>
    </RenderMarkdownBox>
  );
};