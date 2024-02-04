import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { SvgIcon } from '@mui/joy';

/*
 * Source: the PodcastsIcon from '@mui/icons-material/Podcasts';
 */
export function ChatMulticastOffIcon(props: { sx?: SxProps }) {
  return (
    <SvgIcon viewBox='0 0 24 24' width='24' height='24' {...props}>
      <path d='M14 12c0 .74-.4 1.38-1 1.72V22h-2v-8.28c-.6-.35-1-.98-1-1.72 0-1.1.9-2 2-2s2 .9 2 2'></path>
    </SvgIcon>
  );
}