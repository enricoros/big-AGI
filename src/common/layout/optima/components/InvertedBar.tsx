import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Sheet, styled, useTheme } from '@mui/joy';


export const InvertedBarCornerItem = styled(Box)({
  width: 'var(--Bar)',
  height: 'var(--Bar)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
});


const InvertedBarBase = styled(Sheet)({
  // customization
  '--Bar': 'var(--AGI-Nav-width)',

  // layout
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});


// This is the AppBar and the MobileAppNav and DesktopNav
export const InvertedBar = (props: {
  id?: string,
  direction: 'horizontal' | 'vertical',
  sx?: SxProps
  children: React.ReactNode,
}) => {

  // check for dark mode
  const theme = useTheme();
  const isDark = theme?.palette.mode === 'dark';

  return <InvertedBarBase
    id={props.id}
    variant={isDark ? 'soft' : 'solid'}
    invertedColors={!isDark ? true : undefined}
    sx={
      props.direction === 'horizontal'
        ? {
          // minHeight: 'var(--Bar)',
          flexDirection: 'row',
          // overflow: 'hidden',
          ...props.sx,
        } : {
          // minWidth: 'var(--Bar)',
          flexDirection: 'column',
          ...props.sx,
        }
    }
  >
    {props.children}
  </InvertedBarBase>;
};