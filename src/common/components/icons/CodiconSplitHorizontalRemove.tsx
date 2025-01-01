import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function CodiconSplitHorizontalRemove(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 16 16' width={16} height={16} fill='currentColor' {...props}>
      <path d='M2 1 1 2v12l1 1h12l1-1V2l-1-1Zm0 1h12v12H2Zm6 2v3h1V4Zm0 5v3h1V9Z' />
    </SvgIcon>
  );
}