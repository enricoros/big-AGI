import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function SakanaAIIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='currentColor' stroke='none' {...props}>
    {/* fish body with eye cut-out (sakana = 'fish') */}
    <path fillRule='evenodd' clipRule='evenodd' d='M2 12C4 8 8 6 12 7C15 7.5 17 9.5 18 12C17 14.5 15 16.5 12 17C8 18 4 16 2 12ZM7.5 10.5C7.5 11.05 7.05 11.5 6.5 11.5C5.95 11.5 5.5 11.05 5.5 10.5C5.5 9.95 5.95 9.5 6.5 9.5C7.05 9.5 7.5 9.95 7.5 10.5Z' />
    {/* tail fin */}
    <path d='M18 12L22.5 8.5V15.5L18 12Z' />
  </SvgIcon>;
}
