import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/**
 * Cerebras brandmark - concentric "C" (nested wafer rings opening to the right).
 * Official symbol geometry, wordmark removed; rings stay concentric within a square viewBox.
 */
export function CerebrasIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 48 48' width='24' height='24' fill='none' stroke='currentColor' strokeWidth={3.085} strokeMiterlimit={10} {...props}>
    <path fill='none' d='M24 46C11.85 46 2 36.15 2 24S11.85 2 24 2M12.666 37.596c-7.497-6.29-8.474-17.465-2.184-24.962S27.948 4.16 35.445 10.45m-17.78 25.44c-6.562-3.464-9.074-11.594-5.61-18.156 3.465-6.564 11.593-9.075 18.157-5.61M24 33.157a9.156 9.156 0 0 1 0-18.313' />
  </SvgIcon>;
}
