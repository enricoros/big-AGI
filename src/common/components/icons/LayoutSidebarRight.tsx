import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function LayoutSidebarRight(props: SvgIconProps) {
  return (
    <SvgIcon
      viewBox='0 0 16 16'
      width={16}
      height={16}
      fill='currentColor'
      {...props}
    >
      <path d='M2 1 1 2v12l1 1h12l1-1V2l-1-1H2zm0 1h6v12H2V2zm7 0h5v12H9V2zm1 1v1h3V3h-3zm0 2v1h3V5h-3zm0 2v1h3V7h-3z' />
    </SvgIcon>
  );
}