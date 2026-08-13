import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

// Modular brandmark: the stepped 'M' (right stem starts below the apex).
// Official geometry from modular.com's webclip/favicon svg (webflow CDN, 256px artboard), background rect dropped,
// scaled 1/8 and recentered to 24x24, axis-aligned segments compacted to H/V - no shape edits - 2026-08-13
export function ModularIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='currentColor' stroke='none' {...props}>
    <path d='M20.885 5.35H23V21.5H20.744V5.486C20.744 5.411 20.68 5.35 20.603 5.35H19.615L13.692 21.5H10.308L4.385 5.35H3.256V21.5H1V2.5H5.654L11.718 19.057H12.282L18.346 2.5H20.744V5.214C20.744 5.289 20.807 5.35 20.885 5.35Z' />
  </SvgIcon>;
}
