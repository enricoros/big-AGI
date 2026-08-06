import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function ZAIIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 30 30' width={24} height={24} fill='currentColor' strokeWidth={0} {...props}>
      <path d='M15.47,7.1l-1.3,1.85c-0.2,0.29-0.54,0.47-0.9,0.47h-7.1V7.09C6.16,7.1,15.47,7.1,15.47,7.1z' />
      <polygon points='24.3,7.1 13.14,22.91 5.7,22.91 16.86,7.1' />
      <path d='M14.53,22.91l1.31-1.86c0.2-0.29,0.54-0.47,0.9-0.47h7.09v2.33H14.53z' />
    </SvgIcon>
  );
}