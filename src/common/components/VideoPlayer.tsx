import * as React from 'react';

import type { YouTubePlayerProps } from 'react-player/youtube';


type VideoPlayerProps = YouTubePlayerProps & {
  // make the player responsive
  responsive?: boolean;
  // set this to not set the full URL
  vimeoVideoId?: string;
  // set this to not set the full URL
  youTubeVideoId?: string;
};

const VideoPlayerDynamic = React.lazy(async () => {

  // dynamically import react-player (saves 7kb but still..)
  const { default: ReactPlayerVimeo } = await import('react-player/vimeo');
  const { default: ReactPlayerYouTube } = await import('react-player/youtube');

  return {
    default: (props: YouTubePlayerProps) => {

      const { responsive, youTubeVideoId, vimeoVideoId, ...baseProps } = props;

      // responsive patch
      if (responsive) {
        baseProps.width = '100%';
        baseProps.height = '100%';
      }

      // Vimeo Video ID
      if (props.vimeoVideoId)
        baseProps.url = `https://vimeo.com/${props.vimeoVideoId}`;
      if (baseProps.url?.indexOf('vimeo.') > 0)
        return <ReactPlayerVimeo {...baseProps} />;

      // YouTube video ID
      if (youTubeVideoId)
        baseProps.url = `https://www.youtube.com/watch?v=${youTubeVideoId}`;

      // fallback to YouTube
      return <ReactPlayerYouTube {...baseProps} />;
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