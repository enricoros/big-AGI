import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function XAIIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 24 24' width={24} height={24} fill='currentColor' {...props}>
      <path d='m3.005 8.858 8.783 12.544h3.904L6.908 8.858zm3.9 6.967L3 21.402h3.907l1.951-2.788zM16.585 2l-6.75 9.64 1.953 2.79L20.492 2zm.707 5.965v13.437h3.2V3.395z' />
    </SvgIcon>
  );
}