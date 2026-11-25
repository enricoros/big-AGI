import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/**
 * The AssemblyAI mark (the 'A' of the logo) in currentColor: the right stroke, grey in the brand file, at reduced opacity;
 * the left stroke is cut where the right one covers it, so the overlap does not show through.
 */
export function AssemblyAIIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 32 28' width='24' height='24' stroke='none' fill='currentColor' {...props}>
    <path d='M17.059,8.424c-0.187,-0.476 -0.645,-0.807 -1.18,-0.807c-0.535,0 -0.994,0.331 -1.18,0.807l-7.481,19.446h-7.218l9.502,-24.709v0.007l-0.289,0.756c0.526,-1.172 1.707,-1.996 3.065,-1.996c1.359,0 2.53,0.815 3.057,1.987l1.734,4.509z' />
    <path d='M9.502,3.159c0.705,-1.826 2.412,-3.057 4.331,-3.159h0.246h3.736c2.03,0 3.847,1.257 4.577,3.159l9.502,24.71h-7.345l-9.213,-23.955c-0.526,-1.172 -1.698,-1.987 -3.057,-1.987c-1.359,0 -2.539,0.824 -3.065,1.996l0.289,-0.756z' fillOpacity={0.6} />
  </SvgIcon>;
}
