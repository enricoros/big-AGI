import * as React from 'react';

import { Box } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import type { LatexBlock } from './blocks';


// Dynamically import the Katex functions
const RenderLatexDynamic = React.lazy(async () => {
  const { InlineMath } = await import('react-katex');
  return {
    default: (props: { latex: string }) => <InlineMath math={props.latex} />,
  };
});

export const RenderLatex = (props: { latexBlock: LatexBlock; sx?: SxProps; }) =>
  <Box
    sx={{
      mx: 1.5,
      my: '0.5em',
      textAlign: 'center',
      ...props.sx,
    }}>
    <React.Suspense fallback={<div />}>
      <RenderLatexDynamic latex={props.latexBlock.latex} />
    </React.Suspense>
  </Box>;