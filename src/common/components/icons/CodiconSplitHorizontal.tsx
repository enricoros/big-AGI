import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function CodiconSplitHorizontal(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 16 16' width={16} height={16} fill='currentColor' {...props}>
      <path d='M2 1 1 2v12l1 1h12l1-1V2l-1-1H2Zm0 13V2h7v12H2Z' />
    </SvgIcon>
  );
}