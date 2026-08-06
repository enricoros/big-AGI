import * as React from 'react';

import ReactPlayer from 'react-player';
import type { ReactPlayerProps } from 'react-player/types';

export function VideoPlayerVimeo(props: ReactPlayerProps & {
  vimeoVideoId: string; // set this to not set the full URL
  responsive?: boolean; // make the player responsive
}) {

  const { responsive, vimeoVideoId, ...playerProps } = props;

  // responsive patch
  if (responsive) {
    playerProps.width = '100%';
    playerProps.height = '100%';
  }

  // src from video id
  if (vimeoVideoId)
    playerProps.src = `https://vimeo.com/${vimeoVideoId}`;

  return <ReactPlayer {...playerProps} />;
}