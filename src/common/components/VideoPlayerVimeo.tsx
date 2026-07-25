import { LiteVideoEmbed } from './LiteVideoEmbed';


export function VideoPlayerVimeo(props: {
  vimeoVideoId: string;
  title?: string;                       // a11y label + poster overlay; defaults to the oEmbed title
  play?: 'click' | 'auto' | 'ambient';  // see LiteVideoEmbed
  playing?: boolean;                    // legacy alias for play='ambient' (dev-branch call sites)
  loop?: boolean;
  rounded?: boolean;
  responsive?: boolean;                 // fill the parent, 16:9 fallback
  width?: number | string;
  height?: number | string;
}) {
  const { vimeoVideoId, play, playing, ...embedProps } = props;
  return <LiteVideoEmbed platform='vimeo' videoId={vimeoVideoId} play={play ?? (playing ? 'ambient' : undefined)} {...embedProps} />;
}
