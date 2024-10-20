import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function CodiconSplitVerticalRemove(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 16 16' width={16} height={16} fill='currentColor' {...props}>
      <path d='M2 1 1 2v12l1 1h12l1-1V2l-1-1H2zm0 1h12v12H2V2zm2 6v1h3V8H4zm5 0v1h3V8H9z' />
    </SvgIcon>
  );
}