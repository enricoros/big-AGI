import * as React from 'react';

import type { YouTubePlayerProps as ReactPlayerYouTubeProps } from 'react-player/youtube';


type VideoPlayerProps = ReactPlayerYouTubeProps & {
  // make the player responsive
  responsive?: boolean;
  // set this to not set the full URL
  youTubeVideoId?: string;
};

const DynamicYouTubePlayer = React.lazy(async () => {

  // dynamically import react-player (saves 7kb but still..)
  const { default: ReactPlayerYouTube } = await import('react-player/youtube');

  return {
    default: (props: ReactPlayerYouTubeProps) => {

      const { responsive, youTubeVideoId, ...baseProps } = props;

      // responsive patch
      if (responsive) {
        baseProps.width = '100%';
        baseProps.height = '100%';
      }

      // YouTube Video ID
      if (youTubeVideoId)
        baseProps.url = `https://www.youtube.com/watch?v=${youTubeVideoId}`;

      return <ReactPlayerYouTube {...baseProps} />;
    },
  };
});


export function VideoPlayerYouTube(props: VideoPlayerProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <DynamicYouTubePlayer {...props} />
    </React.Suspense>
  );
}