import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/*
 * Source: 'https://phosphoricons.com/' - device-mobile
 */
export function PhDeviceMobile(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 256 256' stroke='none' fill='currentColor' width='24' height='24' {...props}>
      <path d='M176,16H80A24,24,0,0,0,56,40V216a24,24,0,0,0,24,24h96a24,24,0,0,0,24-24V40A24,24,0,0,0,176,16ZM72,64H184V192H72Zm8-32h96a8,8,0,0,1,8,8v8H72V40A8,8,0,0,1,80,32Zm96,192H80a8,8,0,0,1-8-8v-8H184v8A8,8,0,0,1,176,224Z' />
    </SvgIcon>
  );
}
