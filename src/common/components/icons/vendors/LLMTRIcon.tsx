import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/**
 * LLMTR in-app mark from https://llmtr.com/logo-mark.svg (2026-11-27).
 * The crescent and token dots inherit currentColor; the star stays the brand red.
 */
export function LLMTRIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 53 36' width='24' height='24' fill='currentColor' stroke='none' {...props}>
    <circle cx='2' cy='18' r='1.8' opacity={0.3} />
    <circle cx='8' cy='18' r='1.8' opacity={0.55} />
    <circle cx='14' cy='18' r='1.8' opacity={0.85} />
    <path fillRule='evenodd' d='M 38 18 A 11 11 0 1 0 16 18 A 11 11 0 1 0 38 18 Z M 38 18 A 8 8 0 1 0 22 18 A 8 8 0 1 0 38 18 Z' />
    <polygon points='46,13 47.12,16.45 50.76,16.45 47.82,18.59 48.94,22.05 46,19.91 43.06,22.05 44.18,18.59 41.24,16.45 44.88,16.45' fill='#B91C1C' />
  </SvgIcon>;
}
