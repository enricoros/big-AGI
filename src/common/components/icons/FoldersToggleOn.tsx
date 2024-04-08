import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function FoldersToggleOn(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' stroke='none' fill='currentColor' {...props}>
    <path d='m9.17 6 2 2H20v10H4V6zM10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8z' />
    <path d='M 16,15 12,10 8,15 Z' />
  </SvgIcon>;
}