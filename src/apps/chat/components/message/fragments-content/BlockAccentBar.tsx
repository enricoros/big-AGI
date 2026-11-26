import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, type ColorPaletteProp } from '@mui/joy';


const _styles = {
  block: {
    mx: 1.5, // aligns with the text blocks (RenderPlainText)
    display: 'flex',
  },
  line: {
    mt: 0.5,
    mb: 0.625,
    width: 3,
    flexShrink: 0,
    borderRadius: 1.5,
  },
  content: {
    pl: 1.5,
    display: 'grid',
    justifyItems: 'start',
    gap: 0.5,
    overflowWrap: 'anywhere',
  },
} as const satisfies Record<string, SxProps>;


/**
 * A colored bar beside a content column; the children bring their own text styles.
 * Two users: the issue block (BlockPartAixIssue), and a state of the whole message that is not a record (out of tokens,
 * drawn by ChatMessage from the outcome at the end of the content: nothing is stored).
 */
export function BlockAccentBar(props: {
  tint: ColorPaletteProp,
  children: React.ReactNode,
}) {
  return (
    <Box sx={_styles.block}>

      {/* Left line */}
      <Box sx={{ ..._styles.line, backgroundColor: `${props.tint}.400` }} />

      <Box sx={_styles.content}>
        {props.children}
      </Box>

    </Box>
  );
}
