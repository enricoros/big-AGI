import { LiteVideoEmbed } from './LiteVideoEmbed';


export function VideoPlayerYouTube(props: {
  youTubeVideoId: string;
  title?: string;                       // a11y label + poster overlay
  play?: 'click' | 'auto' | 'ambient';  // see LiteVideoEmbed
  playing?: boolean;                    // legacy alias for play='ambient' (dev-branch call sites)
  loop?: boolean;
  rounded?: boolean;
  responsive?: boolean;                 // fill the parent, 16:9 fallback
  width?: number | string;
  height?: number | string;
}) {
  const { youTubeVideoId, play, playing, ...embedProps } = props;
  return <LiteVideoEmbed platform='youtube' videoId={youTubeVideoId} play={play ?? (playing ? 'ambient' : undefined)} {...embedProps} />;
}
