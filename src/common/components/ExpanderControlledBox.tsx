import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, styled } from '@mui/joy';


const BoxCollapser = styled(Box)({
  display: 'grid',
  transition: 'grid-template-rows 0.2s cubic-bezier(.17,.84,.44,1)',
  gridTemplateRows: '0fr',
  '&[aria-expanded="true"]': {
    gridTemplateRows: '1fr',
  },
});

const BoxCollapsee = styled(Box)({
  overflow: 'hidden',
});


export function ExpanderControlledBox(props: { expanded: boolean, children: React.ReactNode, sx?: SxProps }) {
  return (
    <BoxCollapser aria-expanded={props.expanded} sx={props.sx}>
      <BoxCollapsee>
        {props.children}
      </BoxCollapsee>
    </BoxCollapser>
  );
}