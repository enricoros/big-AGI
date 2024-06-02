import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function AzureIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' stroke='currentColor' strokeWidth={1.5} fill='none' strokeLinecap='round' strokeLinejoin='round' {...props}>
    {/*<path stroke='none' d='M0 0h24v24H0z' fill='none'></path>*/}
    <path stroke='none' d='M0 0h24v24H0z' fill='none' />
    <path d='M6 7.5l-4 9.5h4l6 -15z' />
    <path d='M22 20l-7 -15l-3 7l4 5l-8 3z' />
  </SvgIcon>;
}