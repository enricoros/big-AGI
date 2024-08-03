import * as React from 'react';

import { Box } from '@mui/joy';


export function RenderCodeSyntax(props: {
  highlightedSyntaxAsHtml: string;
}) {
  return (
    <Box
      component='div'
      className='code-container'
      dangerouslySetInnerHTML={{ __html: props.highlightedSyntaxAsHtml }}
    />
  );
}
