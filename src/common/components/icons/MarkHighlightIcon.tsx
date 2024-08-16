import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/*
 * Source: '@mui/icons-material/DriveFileRenameOutline';
 */
export function MarkHighlightIcon(props: SvgIconProps & { hcolor?: string }) {
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' {...props}>
      <path d='M18.41 5.8 17.2 4.59c-.78-.78-2.05-.78-2.83 0l-2.68 2.68L3 15.96V20h4.04l8.74-8.74 2.63-2.63c.79-.78.79-2.05 0-2.83M6.21 18H5v-1.21l8.66-8.66 1.21 1.21z'></path>
      <path d='M11 20l4-4h6v4z' fill={props.hcolor || 'currentColor'} stroke={props.hcolor ? 'currentColor' : undefined} strokeWidth={1.5}></path>
      {props.hcolor && <path d='M6.21 18H5v-1.21l8.66-8.66 1.21 1.21z' fill={props.hcolor}></path>}
    </SvgIcon>
  );
}