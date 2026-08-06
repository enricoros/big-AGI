import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';


export function PhRamble(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 256 256' stroke='none' fill='currentColor' width='24' height='24' {...props}>
      <path d='M48,96a8,8,0,0,1,8,8v48a8,8,0,0,1-16,0V104A8,8,0,0,1,48,96Zm40-48a8,8,0,0,0-8,8V200a8,8,0,0,0,16,0V56A8,8,0,0,0,88,48Zm40,32a8,8,0,0,0-8,8v80a8,8,0,0,0,16,0V88A8,8,0,0,0,128,80Zm40-56a8,8,0,0,0-8,8V224a8,8,0,0,0,16,0V32A8,8,0,0,0,168,24Zm40,72a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V104A8,8,0,0,0,208,96Z' />
    </SvgIcon>
  );
}
