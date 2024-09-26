import * as React from 'react';

import { Box } from '@mui/joy';


export function RenderCodeSyntax(props: {
  highlightedSyntaxAsHtml: string | null;
  presenterMode?: boolean;
}) {
  return (
    <Box
      component='div'
      aria-label='Code block'
      className='code-container'
      dangerouslySetInnerHTML={{ __html: props.highlightedSyntaxAsHtml ?? '' }}
      sx={props.presenterMode ? { fontSize: '125%' } : undefined}
    />
  );
}
