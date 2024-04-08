import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

export function AnthropicIcon(props: SvgIconProps) {
  return <SvgIcon viewBox='10 15 225 225' width='24' height='24' stroke='currentColor' fill='none' strokeLinecap='round' strokeLinejoin='round' {...props}>
    <path d='M47.1 124.4l-30.1 76c0 .3 7.6.6 16.9.6h16.9l3.6-9.2 6-15.8 2.4-6.5 31.5-.3 31.5-.2 3 7.7 6.2 16 3.2 8.3h16.9c9.3 0 16.9-.2 16.9-.4s-8.5-21.7-18.9-47.8L123 77.2 111.8 49H94.5 77.2l-30.1 75.4zm57.3-10.4l9.6 25.2c0 .5-8.8.8-19.5.8s-19.5-.3-19.5-.8c0-.4 3.4-9.5 7.6-20.2l9.6-24.8c1.1-2.9 2.1-5.2 2.3-5s4.7 11.3 9.9 24.8zM140 50.2c0 .7 13.4 34.8 29.8 75.8l29.7 74.5 16.9.3c9.9.1 16.6-.1 16.4-.7-.1-.5-13.8-34.7-30.2-76l-30-75.1h-16.3c-12.4 0-16.3.3-16.3 1.2z' />
  </SvgIcon>;
}