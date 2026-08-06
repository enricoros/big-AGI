import * as React from 'react';

import { SvgIcon, SvgIconProps } from '@mui/joy';

/*
 * Source: the PodcastsIcon from '@mui/icons-material/Podcasts';
 */
export function ChatMulticastOffIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' {...props}>
      <path d='M14 12c0 .74-.4 1.38-1 1.72V22h-2v-8.28c-.6-.35-1-.98-1-1.72 0-1.1.9-2 2-2s2 .9 2 2m-2-6c-3.31 0-6 2.69-6 6 0 1.74.75 3.31 1.94 4.4l1.42-1.42C8.53 14.25 8 13.19 8 12c0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.19-.53 2.25-1.36 2.98l1.42 1.42C17.25 15.31 18 13.74 18 12c0-3.31-2.69-6-6-6'></path>
    </SvgIcon>
  );
}