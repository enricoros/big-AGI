import * as React from 'react';

import { Box } from '@mui/joy';

import { RenderMarkdown } from '../../markdown/RenderMarkdown';


export function RenderCodeMarkdown(props: { mdCode: string }) {
  return (
    <Box className='code-container'>
      <RenderMarkdown content={props.mdCode} />
    </Box>
  );
}
