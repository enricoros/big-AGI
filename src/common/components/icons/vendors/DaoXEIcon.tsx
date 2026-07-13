import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/** Monochrome mark for DaoXE dynamic OpenAI-compatible backend detection. */
export function DaoXEIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='currentColor' stroke='none' {...props}>
      {/* Stylized "D" gateway mark */}
      <path d='M4 4h8c4.4 0 8 3.6 8 8s-3.6 8-8 8H4V4zm3.2 3.2v9.6H12c2.65 0 4.8-2.15 4.8-4.8S14.65 7.2 12 7.2H7.2z' />
      <path d='M6 11h12v2H6z' opacity='0.35' />
    </SvgIcon>
  );
}
