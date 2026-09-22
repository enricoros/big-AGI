import * as React from 'react';

import { Box } from '@mui/joy';


const _fullscreenSx = {
  fontSize: '125%',
} as const;


export function RenderCodeSyntax(props: {
  highlightedSyntaxAsHtml: string | null;
  presenterMode?: boolean;
}) {
  return (
    <Box
      // Perf: a new element per highlight, so React sets innerHTML before inserting it. Replacing the innerHTML of an
      // element already in the page is quadratic in Firefox (100K chars of code: 733 ms vs 47 ms); matters while streaming
      key={props.highlightedSyntaxAsHtml?.length ?? 0}
      component='span'
      aria-label='Code block'
      className='code-container'
      dangerouslySetInnerHTML={{ __html: props.highlightedSyntaxAsHtml ?? '' }}
      sx={props.presenterMode ? _fullscreenSx : undefined}
    />
  );
}
