import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function MiniMaxIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' strokeWidth={0} stroke='none' fill='currentColor' {...props}>
    <path d='M3 4h4l5 8 5-8h4v16h-4V9.5L12 16l-5-6.5V20H3V4z' />
  </SvgIcon>;
}
