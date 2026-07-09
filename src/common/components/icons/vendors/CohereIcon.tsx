import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

// Cohere logomark (the "coral" mark): three overlapping rounded shapes.
// Rendered monochrome (currentColor) to match the app's themed vendor-icon convention.
// Source: Cohere brand mark (LobeHub AI icon set) - 2026-07-08.
export function CohereIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='currentColor' fillRule='evenodd' stroke='none' {...props}>
    <path d='M8.128 14.099c.592 0 1.77-.033 3.398-.703 1.897-.781 5.672-2.2 8.395-3.656 1.905-1.018 2.74-2.366 2.74-4.18A4.56 4.56 0 0018.1 1H7.549A6.55 6.55 0 001 7.55c0 3.617 2.745 6.549 7.128 6.549z' />
    <path d='M9.912 18.61a4.387 4.387 0 012.705-4.052l3.323-1.38c3.361-1.394 7.06 1.076 7.06 4.715a5.104 5.104 0 01-5.105 5.104l-3.597-.001a4.386 4.386 0 01-4.386-4.387z' />
    <path d='M4.776 14.962A3.775 3.775 0 001 18.738v.489a3.776 3.776 0 007.551 0v-.49a3.775 3.775 0 00-3.775-3.775z' />
  </SvgIcon>;
}
