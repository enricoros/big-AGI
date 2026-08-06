import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

// This icon has been converted from the official SVG of the Alibaba Cloud logo
export function AlibabaCloudIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' {...props}>
    <path d='m 8.025,12.9 h 7.95 v -1.8 h -7.95 z' />
    <path d='M 19.9875,4.5 H 14.7 l 1.275,1.8 3.8625,1.2 C 20.55,7.725 21,8.3625 21,9.1125 v 5.775 c 0,0.75 -0.45,1.3875 -1.1625,1.6125 L 15.975,17.7 14.7,19.5 h 5.2875 C 22.2375,19.5 24,17.7 24,15.4875 V 8.5125 C 24,6.2625 22.2,4.5 19.9875,4.5 m -15.975,0 H 9.3 L 8.025,6.3 4.1625,7.5 A 1.6875,1.6875 0 0 0 3,9.1125 v 5.775 c 0,0.75 0.45,1.3875 1.1625,1.6125 L 8.025,17.7 9.3,19.5 H 4.0125 C 1.7625,19.5 0,17.7 0,15.4875 V 8.5125 C 0,6.2625 1.8,4.5 4.0125,4.5' />
  </SvgIcon>;
}