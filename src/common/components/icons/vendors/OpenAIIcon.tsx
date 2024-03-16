import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function OpenAIIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' stroke='currentColor' strokeWidth={1.5} fill='none' strokeLinecap='round' strokeLinejoin='round' {...props}>
    {/*<path stroke='none' d='M0 0h24v24H0z' fill='none'></path>*/}
    <path d='M11.217 19.384a3.501 3.501 0 0 0 6.783 -1.217v-5.167l-6 -3.35' fill='none' />
    <path d='M5.214 15.014a3.501 3.501 0 0 0 4.446 5.266l4.34 -2.534v-6.946' fill='none' />
    <path d='M6 7.63c-1.391 -.236 -2.787 .395 -3.534 1.689a3.474 3.474 0 0 0 1.271 4.745l4.263 2.514l6 -3.348' fill='none' />
    <path d='M12.783 4.616a3.501 3.501 0 0 0 -6.783 1.217v5.067l6 3.45' fill='none' />
    <path d='M18.786 8.986a3.501 3.501 0 0 0 -4.446 -5.266l-4.34 2.534v6.946' fill='none' />
    <path d='M18 16.302c1.391 .236 2.787 -.395 3.534 -1.689a3.474 3.474 0 0 0 -1.271 -4.745l-4.308 -2.514l-5.955 3.42' fill='none' />
  </SvgIcon>;
}