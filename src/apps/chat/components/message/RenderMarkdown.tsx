import * as React from 'react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Box, useTheme } from '@mui/joy';

import { TextBlock } from './Block';

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
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{textBlock.content}</ReactMarkdown>
    </Box>
  );
};