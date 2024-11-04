import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/*
 * Source: the MultipleStopIcon from '@mui/icons-material/Podcasts';
 */
export function LiveFilePatchIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' {...props}>
      <path d='m 11,7 v 4 h 2 V 7 h 3 L 12,3 8,7 Z m 0,7 c 0,0.55 0.45,1 1,1 0.55,0 1,-0.45 1,-1 0,-0.55 -0.45,-1 -1,-1 -0.55,0 -1,0.45 -1,1 m 0,4 c 0,0.55 0.45,1 1,1 0.55,0 1,-0.45 1,-1 0,-0.55 -0.45,-1 -1,-1 -0.55,0 -1,0.45 -1,1' />
    </SvgIcon>
  );
}