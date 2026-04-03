import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function OpenPipeIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' strokeWidth={0} stroke='none' fill='currentColor' strokeLinecap='butt' strokeLinejoin='miter' {...props}>
    <path
      d='m 6.2,6.5 h 11.6 V 21.3 A 0.7,0.7 0 0 1 17.1,22 H 6.9 A 0.7,0.7 0 0 1 6.2,21.3 Z'
      stroke='currentColor' strokeWidth={1}
    />
    <path
      d='M 4.8,2.7 A 0.7,0.7 0 0 1 5.5,2 h 13 a 0.7,0.7 0 0 1 0.7,0.7 V 6.2 A 0.7,0.7 0 0 1 18.5,6.9 H 5.5 A 0.7,0.7 0 0 1 4.8,6.2 Z'
      stroke='currentColor' strokeWidth={1}
    />
    {/* This is the orange part - comment? */}
    <path
      d='M 6.6,6.9 H 17.4 V 21.2 A 0.4,0.4 0 0 1 17.1,21.6 H 6.9 A 0.4,0.4 0 0 1 6.6,21.2 Z M 5.2,2.7 A 0.4,0.4 0 0 1 5.5,2.4 H 18.5 a 0.4,0.4 0 0 1 0.4,0.4 V 6.1 A 0.4,0.4 0 0 1 18.5,6.5 H 5.5 A 0.4,0.4 0 0 1 5.2,6.1 Z'
      fill='#ff5733' />
    <path
      d='M 8.7,7.2 H 10.4 V 21.5 H 8.7 V 7.2 Z'
      fill='#ffffff' />
    <path
      d='m 15.7,6.9 h 1.7 V 21.2 a 0.4,0.4 0 0 1 -0.4,0.4 h -1.4 z'
      fill='#ffffff' fillOpacity={0.25} />
    <path
      d='M 8.3,7.2 H 8.7 V 21.5 H 8.3 Z'
      fill='#ffffff' fillOpacity={0.5} />
    <path
      d='M 7.8,2.4 H 9.6 V 6.4 H 7.8 V 2.4 Z'
      fill='#ffffff' />
    <path
      d='m 17.1,2.4 h 1.4 a 0.4,0.4 0 0 1 0.4,0.4 v 3.4 a 0.4,0.4 0 0 1 -0.4,0.4 h -1.4 z'
      fill='#ffffff' fillOpacity={0.25} />
    <path
      d='M 7.4,2.4 H 7.8 V 6.4 H 7.4 Z'
      fill='#ffffff' fillOpacity={0.25} />
  </SvgIcon>;
}