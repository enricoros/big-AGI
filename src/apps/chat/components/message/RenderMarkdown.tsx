import * as React from 'react';

import { Box, useTheme } from '@mui/joy';

import { TextBlock } from './blocks';


// Dynamically import ReactMarkdown using React.lazy
const ReactMarkdown = React.lazy(async () => {
  const [markdownModule, remarkGfmModule] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm')
  ]);

  // Pass the dynamically imported remarkGfm as children
  const ReactMarkdownWithRemarkGfm = (props: any) => (
    <markdownModule.default remarkPlugins={[remarkGfmModule.default]} {...props} />
  );

  return { default: ReactMarkdownWithRemarkGfm };
});


export const RenderMarkdown = ({ textBlock }: { textBlock: TextBlock }) => {
  const theme = useTheme();
  return (
    <Box
      className={`markdown-body ${theme.palette.mode === 'dark' ? 'markdown-body-dark' : 'markdown-body-light'}`}
      sx={{
        mx: '12px !important',                                // margin: 1.5 like other blocks
        '& table': { width: 'inherit !important' },           // un-break auto-width (tables have 'max-content', which overflows)
        '--color-canvas-default': 'transparent !important',   // remove the default background color
        fontFamily: `inherit !important`,                     // use the default font family
        lineHeight: '1.75 !important',                        // line-height: 1.75 like the text block
      }}>

      {/* Using React.Suspense / React.Lazy loading this */}
      <React.Suspense fallback={<div>Loading...</div>}>
        <ReactMarkdown>{textBlock.content}</ReactMarkdown>
      </React.Suspense>
    </Box>
  );
};