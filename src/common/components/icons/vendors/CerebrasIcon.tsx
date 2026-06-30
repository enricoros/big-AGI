import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/**
 * Cerebras brandmark - stylized concentric "C" (nested wafer rings opening to the right).
 * Traced as a clean geometric mark (no official asset provided).
 */
export function CerebrasIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' {...props}>
    <path d='M18.9 6.21 A9 9 0 1 0 18.9 17.79' fill='none' />
    <path d='M16.6 8.14 A6 6 0 1 0 16.6 15.86' fill='none' />
    <path d='M14.3 10.07 A3 3 0 1 0 14.3 13.93' fill='none' />
  </SvgIcon>;
}
