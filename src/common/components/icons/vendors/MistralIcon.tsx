import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function MistralIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' strokeWidth={0} stroke='none' fill='currentColor' strokeLinecap='butt' strokeLinejoin='miter' {...props}>
    <path d='m 2,2 v 4 4 V 14 v 4 4 h 4 v -4 -4 h 4 v 4 h 4 v -4 h 4 v 4 4 h 4 v -4 -4 -4 -4 V 2 h -4 v 4 h -4 v 4 h -4 v -4 H 6 V 2 Z' />
  </SvgIcon>;
}