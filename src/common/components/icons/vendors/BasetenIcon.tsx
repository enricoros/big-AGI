import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/*
 * Baseten mark, extracted from the baseten.co logo (the wordmark's leading glyph),
 * recentered from its native 22.75x28 box into the 24x24 viewBox.
 */
export function BasetenIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='currentColor' stroke='none' {...props}>
    <path
      transform='translate(2.25 -2.571) scale(0.8571)'
      d='M.36 8.6h16.7v5.6H6.04c-.2 0-.35.16-.35.35v4.9c0 .2.16.35.35.35h11.02v5.6h-5.33c-.2 0-.35.16-.35.35v4.9c0 .2.16.35.35.35h4.98c.2 0 .35-.15.35-.35V25.4h5.34c.2 0 .35-.16.35-.35v-4.9c0-.2-.16-.35-.35-.35h-5.34v-5.6h5.34c.2 0 .35-.16.35-.35v-4.9c0-.2-.16-.35-.35-.35h-5.34V3.35c0-.2-.16-.35-.35-.35H.36c-.2 0-.36.16-.36.35v4.9c0 .2.16.35.36.35Z'
    />
  </SvgIcon>;
}
