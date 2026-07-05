import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/**
 * Sakana AI mark: three calligraphic strokes forming a fish (sakana = 'fish') swimming up-right.
 * Curve-fit against the official brand mark (sakana.ai/sakana-logo.png).
 */
export function SakanaAIIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 32 32' width='24' height='24' fill='none' stroke='currentColor' strokeWidth={1.8} strokeLinecap='round' strokeLinejoin='round' {...props}>
    {/* body: tail-left tip -> back -> nose -> belly -> bottom tip */}
    <path fill='none' d='M3.73 12.4 C8.35 8.84, 13.89 6, 19.83 5.61 C23.79 5.41, 27.49 6.07, 29.53 6.86 C29.33 9.63, 28.02 13.2, 26.3 16.23 C23.92 19.27, 19.43 22.44, 12.5 26.33' />
    {/* gill: T on the back -> descends -> arcs right-down -> T on the belly */}
    <path fill='none' d='M11.71 7.92 C12.44 10.16, 12.83 13.2, 12.77 14.91 C12.83 16.23, 13.76 17.22, 14.88 17.88 C16.79 19, 18.38 20.59, 19.57 22.04' />
    {/* lateral fin: left tip -> rises to the gill -> bends down-left to the tail tip */}
    <path fill='none' d='M2.47 17.49 C5.05 16.96, 8.35 16.34, 10.46 16.17 C12.04 16.07, 13.03 16.69, 13.03 17.55 C13.03 18.48, 12.31 19, 11.78 19.53 C11.12 20.72, 9.01 23.1, 6.83 25.47' />
  </SvgIcon>;
}
