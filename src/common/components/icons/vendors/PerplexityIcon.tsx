import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function PerplexityIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='none' stroke='currentColor' strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round' {...props}>
    <path d='M 12,8.1 5.7,2.3 v 5.9 z' fill='none' />
    <path d='M 12.1,8.1 18.4,2.3 v 5.9 z' fill='none' />
    <path d='M 12,1.3 V 22.8' fill='none' />
    <path d='M 18.3,13.9 12,8.1 v 8 l 6.3,5.6 z' fill='none' />
    <path d='M 5.7,13.9 12,8.1 V 16.2 L 5.7,21.8 Z' fill='none' />
    <path d='M 3.1,8.1 V 16.5 H 5.7 V 13.9 L 12,8.1 Z' fill='none' />
    <path d='m 12,8.2 6.3,5.8 v 2.6 h 2.6 V 8.2 Z' fill='none' />
  </SvgIcon>;
}