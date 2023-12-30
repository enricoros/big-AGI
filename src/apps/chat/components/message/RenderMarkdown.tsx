import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, useTheme } from '@mui/joy';

import type { TextBlock } from './blocks';


// Dynamically import ReactMarkdown using React.lazy
const ReactMarkdown = React.lazy(async () => {
  const [markdownModule, remarkGfmModule] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);

  // Pass the dynamically imported remarkGfm as children
  const ReactMarkdownWithRemarkGfm = (props: any) => (
    <markdownModule.default remarkPlugins={[remarkGfmModule.default]} {...props} />
  );

  return { default: ReactMarkdownWithRemarkGfm };
});


export const RenderMarkdown = (props: { textBlock: TextBlock, sx?: SxProps }) => {
  const theme = useTheme();
  return (
    <Box
      className={`markdown-body ${theme.palette.mode === 'dark' ? 'markdown-body-dark' : 'markdown-body-light'}`}
      sx={{
        mx: '12px !important',                                // margin: 1.5 like other blocks
        '& table': { width: 'inherit !important' },           // un-break auto-width (tables have 'max-content', which overflows)
        '--color-canvas-default': 'transparent !important',   // remove the default background color
        // NOTE: the following are not needed because the CSS is under our control, and we
        //       disabled the redefintions there
        // fontFamily: `inherit !important`,                  // use the default font family
        ...(props.sx || {}),
      }}>

      {/* Using React.Suspense / React.Lazy loading this */}
      <React.Suspense fallback={<div>Loading...</div>}>
        <ReactMarkdown>{props.textBlock.content}</ReactMarkdown>
      </React.Suspense>
    </Box>
  );
};