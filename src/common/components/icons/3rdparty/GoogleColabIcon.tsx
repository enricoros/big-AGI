import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/**
 * This is taken from wikipedia: https://upload.wikimedia.org/wikipedia/commons/d/d0/Google_Colaboratory_SVG_Logo.svg
 */
export function GoogleColabIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='977' height='602' stroke='none' fill='currentColor' {...props}>
    <path d='M4.54,9.46,2.19,7.1a6.93,6.93,0,0,0,0,9.79l2.36-2.36A3.59,3.59,0,0,1,4.54,9.46Z' fill='#E8710A' />
    <path d='M2.19,7.1,4.54,9.46a3.59,3.59,0,0,1,5.08,0l1.71-2.93h0l-.1-.08h0A6.93,6.93,0,0,0,2.19,7.1Z' fill='#F9AB00' />
    <path d='M11.34,17.46h0L9.62,14.54a3.59,3.59,0,0,1-5.08,0L2.19,16.9a6.93,6.93,0,0,0,9,.65l.11-.09' fill='#F9AB00' />
    <path d='M12,7.1a6.93,6.93,0,0,0,0,9.79l2.36-2.36a3.59,3.59,0,1,1,5.08-5.08L21.81,7.1A6.93,6.93,0,0,0,12,7.1Z' fill='#F9AB00' />
    <path d='M21.81,7.1,19.46,9.46a3.59,3.59,0,0,1-5.08,5.08L12,16.9A6.93,6.93,0,0,0,21.81,7.1Z' fill='#E8710A' />
  </SvgIcon>;
}