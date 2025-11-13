import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/*
 * Source: 'https://phosphoricons.com/' - megaphone
 */
export function PhMegaphone(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 256 256' stroke='none' fill='currentColor' width='24' height='24' {...props}>
      <path d='M248,120a48.05,48.05,0,0,0-48-48H160.2c-2.91-.17-53.62-3.74-101.91-44.24A16,16,0,0,0,32,40V200a16,16,0,0,0,26.29,12.25c37.77-31.68,77-40.76,93.71-43.3v31.72A16,16,0,0,0,159.12,214l11,7.33A16,16,0,0,0,194.5,212l11.77-44.36A48.07,48.07,0,0,0,248,120ZM48,199.93V40h0c42.81,35.91,86.63,45,104,47.24v65.48C134.65,155,90.84,164.07,48,199.93Zm131,8,0,.11-11-7.33V168h21.6ZM200,152H168V88h32a32,32,0,1,1,0,64Z' />
    </SvgIcon>
  );
}
