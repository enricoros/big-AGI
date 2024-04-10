import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function ChatBeamIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' stroke='currentColor' fill='currentColor' strokeLinejoin='round'  {...props}>
      <path d='M 4,12 14,9' />
      <path d='M 14,15 4,12' />
      <path d='m 14,15 6,-3' />
      <path d='m 4,12 10,9' />
      <path d='M 14,3 4,12' />
      <rect width='4' height='4' x='2' y='10' />
      <rect width='2' height='2' x='19' y='11' strokeWidth={2} />
      <rect width='2' height='2' x='13' y='2' />
      <rect width='2' height='2' x='13' y='8' />
      <rect width='2' height='2' x='13' y='14' />
      <rect width='2' height='2' x='13' y='20' />
    </SvgIcon>
  );
}