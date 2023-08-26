import * as React from 'react';

import { Box } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { LatexBlock } from './blocks';


// Dynamically import the Katex functions
const RenderLatexDynamic = React.lazy(async () => {
  const { InlineMath } = await import('react-katex');
  return {
    default: (props: { latex: string }) => <InlineMath math={props.latex} />,
  };
});

export const RenderLatex = ({ latexBlock, sx }: { latexBlock: LatexBlock; sx?: SxProps; }) =>
  <Box
    sx={{
      lineHeight: 1.75,
      mx: 1.5,
      ...(sx || {}),
    }}>
    <React.Suspense fallback={<div/>}>
      <RenderLatexDynamic latex={latexBlock.latex} />
    </React.Suspense>
  </Box>;