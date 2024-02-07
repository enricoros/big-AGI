import * as React from 'react';

import type { ReactPlayerProps } from 'react-player';


type VideoPlayerProps = ReactPlayerProps & {
  // make the player responsive
  responsive?: boolean;
  // set this to not set the full URL
  youTubeVideoId?: string;
};

const VideoPlayerDynamic = React.lazy(async () => {

  // dynamically import react-player (saves 7kb but still..)
  const { default: ReactPlayer } = await import('react-player');

  return {
    default: (props: ReactPlayerProps) => {

      const { responsive, youTubeVideoId, ...baseProps } = props;

      // responsive patch
      if (responsive) {
        baseProps.width = '100%';
        baseProps.height = '100%';
      }

      // fill in the URL if we have a YouTube video ID
      if (youTubeVideoId) {
        baseProps.url = `https://www.youtube.com/watch?v=${youTubeVideoId}`;
      }

      return <ReactPlayer {...baseProps} />;
    },
  };
});


export function VideoPlayer(props: VideoPlayerProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <VideoPlayerDynamic {...props} />
    </React.Suspense>
  );
}