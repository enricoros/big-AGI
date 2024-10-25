import * as React from 'react';

import type { VimeoPlayerProps as ReactPlayerVimeoProps } from 'react-player/vimeo';


type VideoPlayerProps = ReactPlayerVimeoProps & {
  // make the player responsive
  responsive?: boolean;
  // set this to not set the full URL
  vimeoVideoId?: string;
};

const DynamicVimeoPlayer = React.lazy(async () => {

  // dynamically import react-player (saves 7kb but still..)
  const { default: ReactPlayerVimeo } = await import('react-player/vimeo');

  return {
    default: (props: ReactPlayerVimeoProps) => {

      const { responsive, vimeoVideoId, ...baseProps } = props;

      // responsive patch
      if (responsive) {
        baseProps.width = '100%';
        baseProps.height = '100%';
      }

      // Vimeo Video ID
      if (vimeoVideoId)
        baseProps.url = `https://vimeo.com/${vimeoVideoId}`;

      return <ReactPlayerVimeo {...baseProps} />;
    },
  };
});


export function VideoPlayerVimeo(props: VideoPlayerProps) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>
      <DynamicVimeoPlayer {...props} />
    </React.Suspense>
  );
}