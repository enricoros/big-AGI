import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function ClaudeCrabIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' stroke='none' fill='none' {...props} sx={{ shapeRendering: 'crispEdges', ...props.sx }}>
    <path d='M4 4 h16 v4 h4 v4 h-4 v8 h-2 v-4 h-2 v4 h-2 v-4 h-4 v4 h-2 v-4 h-2 v4 h-2 v-8 h-4 v-4 h4 z' fill='#F01D1D' />
    <rect x='6' y='6' width='2' height='2' fill='#000000' />
    <rect x='16' y='6' width='2' height='2' fill='#000000' />
  </SvgIcon>;
}