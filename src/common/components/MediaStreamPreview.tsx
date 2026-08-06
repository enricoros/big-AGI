import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { styled } from '@mui/joy';


// add support for the sx prop
const VideoPreview = styled('video')({
  // layout
  backgroundColor: 'var(--joy-palette-neutral-solidActiveBg)',
  display: 'block',

  // style
  borderRadius: 4, // hardcoded, shall be lessa then the outer container's (if that has a border or background)
  objectFit: 'cover',
  // change objectfit to contain (from cover) on hover
  '&:hover': {
    objectFit: 'contain',
  },
});


/**
 * Renders a live video preview from a MediaStream.
 * Shared between LiveFeedThumbnail (Composer) and PanelLiveOperationItem (NB panel).
 */
export function MediaStreamPreview(props: {
  stream: MediaStream;
  width: number;
  height: number;
  sx?: SxProps;
}) {

  // refs
  const videoRef = React.useRef<HTMLVideoElement>(null);


  // [effect] attach/detach MediaStream to this preview's video element
  React.useLayoutEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = props.stream;
    return () => {
      video.srcObject = null;
    };
  }, [props.stream]);


  return (
    <VideoPreview
      ref={videoRef}
      // controls={false} // we don't want controls - althrought the browser may add this back
      autoPlay
      muted
      playsInline
      width={props.width}
      height={props.height}
      sx={props.sx}
    />
  );
}
