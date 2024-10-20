import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function CodiconUnsplit(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 16 16' width={16} height={16} fill='currentColor' {...props}>
      <path d='m1 2 1-1h12l1 1v12l-1 1H2l-1-1zm1 0v12h12V2Z' />
    </SvgIcon>
  );
}