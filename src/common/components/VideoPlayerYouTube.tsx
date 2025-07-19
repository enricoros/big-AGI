import * as React from 'react';

import ReactPlayer from 'react-player';
import type { ReactPlayerProps } from 'react-player/types';

export function VideoPlayerYouTube(props: ReactPlayerProps & {
  youTubeVideoId: string; // set this to not set the full URL
  responsive?: boolean; // make the player responsive
}) {

  const { responsive, youTubeVideoId, ...playerProps } = props;

  // responsive patch
  if (responsive) {
    playerProps.width = '100%';
    playerProps.height = '100%';
  }

  // src from video id
  if (youTubeVideoId)
    playerProps.src = `https://www.youtube.com/watch?v=${youTubeVideoId}`;

  return <ReactPlayer {...playerProps} />;
}