import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function BedrockIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='currentColor' stroke='none' {...props}>
    {/* AWS-style smile arrow mark */}
    <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z' fillOpacity={0.3} />
    <path d='M7.5 14.5c0 0 1.5 3 4.5 3s4.5-3 4.5-3' fill='none' stroke='currentColor' strokeWidth={1.8} strokeLinecap='round' />
    <path d='M17 11l1.5-2.5L17 6' fill='none' stroke='currentColor' strokeWidth={1.5} strokeLinecap='round' strokeLinejoin='round' />
    <path d='M6 8.5h12' fill='none' stroke='currentColor' strokeWidth={1.5} strokeLinecap='round' />
  </SvgIcon>;
}
