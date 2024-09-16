import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function WindowPaneRightOpen(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' {...props}>
      <path d='M 4,2 C 2.9000011,2 2,2.9000011 2,4 v 16 c 0,1.099999 0.9000011,2 2,2 h 16 c 1.099999,0 2,-0.900001 2,-2 V 4 C 22,2.9000011 21.099999,2 20,2 Z m 0,2 h 7 V 20 H 4 Z m 9,0 h 7 v 16 h -7 z m 1,2 v 2 h 5 V 6 Z m 0,3 v 2 h 5 V 9 Z m 0,3 v 2 h 5 v -2 z' />
    </SvgIcon>
  );
}