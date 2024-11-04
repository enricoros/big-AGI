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


const StyledSheet = styled(Sheet)({
  // customization
  '--Bar': 'var(--AGI-Nav-width)',

  // layout
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
}) as typeof Sheet;


// This is the PageBar and the MobileAppNav and DesktopNav
export const InvertedBar = (props: {
  id?: string,
  component: React.ElementType,
  direction: 'horizontal' | 'vertical',
  sx?: SxProps
  children: React.ReactNode,
}) => {

  // check for dark mode
  const theme = useTheme();
  const isDark = theme?.palette.mode === 'dark';


  // memoize the Sx for stability, based on direction
  const sx: SxProps = React.useMemo(() => (
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
  ), [props.direction, props.sx]);


  return (
    <StyledSheet
      id={props.id}
      component={props.component}
      variant={isDark ? 'soft' : 'solid'}
      invertedColors={!isDark ? true : undefined}
      sx={sx}
    >
      {props.children}
    </StyledSheet>
  );
};