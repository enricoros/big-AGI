import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

// Z.ai mark: the official stylized "Z" - a diagonal stroke with a top-left and bottom-right bar.
// Source: LobeHub AI icon set / Wikimedia (Z.ai company logo).
export function ZAIIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='currentColor' fillRule='evenodd' stroke='none' {...props}>
    <path d='M12.105 2L9.927 4.953H.653L2.83 2h9.276zM23.254 19.048L21.078 22h-9.242l2.174-2.952h9.244zM24 2L9.264 22H0L14.736 2H24z' />
  </SvgIcon>;
}
