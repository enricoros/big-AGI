import * as React from 'react';

import type { SxProps, VariantProp } from '@mui/joy/styles/types';
import { Box, Sheet, styled } from '@mui/joy';


export const InvertedBarCornerItem = styled(Box)({
  width: 'var(--Bar)',
  height: 'var(--Bar)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});


const InvertedBarBase = styled(Sheet)({
  // customization
  '--Bar': 'var(--Agi-nav-width)',

  // layout
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});


// This is the AppBar and the MobileAppNav and DesktopNav
export const InvertedBar = (props: {
  direction: 'horizontal' | 'vertical',
  variant?: VariantProp,
  sx?: SxProps
  children: React.ReactNode,
}) =>
  <InvertedBarBase
    variant={props.variant || 'solid'} invertedColors={(props.variant || 'solid') === 'solid' ? true : undefined}
    sx={
      props.direction === 'horizontal'
        ? {
          // minHeight: 'var(--Bar)',
          flexDirection: 'row',
          ...props.sx,
        } : {
          minWidth: 'var(--Bar)',
          flexDirection: 'column',
          ...props.sx,
        }
    }
  >
    {props.children}
  </InvertedBarBase>;