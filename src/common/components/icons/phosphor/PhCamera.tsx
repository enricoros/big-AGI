import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/*
 * Source: 'https://phosphoricons.com/' - camera (regular)
 */
export function PhCamera(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 256 256' stroke='none' fill='currentColor' width='24' height='24' sx={{ fontSize: 24 }} {...props}>
      <path d='M208,56H180.28L166.65,35.56A8,8,0,0,0,160,32H96a8,8,0,0,0-6.65,3.56L75.71,56H48A24,24,0,0,0,24,80V192a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V80A24,24,0,0,0,208,56Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V80a8,8,0,0,1,8-8H80a8,8,0,0,0,6.66-3.56L100.28,48h55.43l13.63,20.44A8,8,0,0,0,176,72h32a8,8,0,0,1,8,8ZM128,88a44,44,0,1,0,44,44A44.05,44.05,0,0,0,128,88Zm0,72a28,28,0,1,1,28-28A28,28,0,0,1,128,160Z' />
    </SvgIcon>
  );
}
