import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function StackBlitzIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 28 28' width='28' height='28' stroke='none' fill='currentColor' {...props}>
    <path d='M12.747 16.273h-7.46L18.925 1.5l-3.671 10.227h7.46L9.075 26.5l3.671-10.227z' />
    <path d='M21 0L28 0L28 7Z' />
  </SvgIcon>;
}