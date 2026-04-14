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
      component='span'
      aria-label='Code block'
      className='code-container'
      dangerouslySetInnerHTML={{ __html: props.highlightedSyntaxAsHtml ?? '' }}
      sx={props.presenterMode ? _fullscreenSx : undefined}
    />
  );
}
