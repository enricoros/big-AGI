import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/*
 * Source: 'https://phosphoricons.com/' - list-checks (regular)
 */
export function PhListChecks(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 256 256' stroke='none' fill='currentColor' width='24' height='24' {...props}>
      <path d='M128,128a8,8,0,0,1-8,8H40a8,8,0,0,1,0-16h80A8,8,0,0,1,128,128ZM40,72H184a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Zm80,112H40a8,8,0,0,0,0,16h80a8,8,0,0,0,0-16Zm133.66-50.34a8,8,0,0,0-11.32,0L208,171.31l-10.34-10.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32,0l40-40A8,8,0,0,0,253.66,131.66Zm0,64a8,8,0,0,0-11.32,0L208,235.31l-10.34-10.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32,0l40-40A8,8,0,0,0,253.66,195.66Z' />
    </SvgIcon>
  );
}
