import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function AvianIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' fill='currentColor' stroke='none' {...props}>
    <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm-5.5 9.5l3-4.5h5l3 4.5-2.5 4h-6l-2.5-4z' />
  </SvgIcon>;
}
