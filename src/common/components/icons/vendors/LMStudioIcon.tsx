import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function LMStudioIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' stroke='none' fill='currentColor' {...props}>
    <rect width='11' height='2' x='3' y='4' ry='1' />
    <rect width='10.5' height='2' x='7.5' y='7' ry='1' />
    <rect width='10.5' height='2' x='5' y='10' ry='1' />
    <rect width='10.5' height='2' x='2' y='13' ry='1' />
    <rect width='10.5' height='2' x='5' y='16' ry='1' />
    <rect width='7' height='2' x='11.5' y='19' ry='1' />
  </SvgIcon>;
}