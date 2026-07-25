import * as React from 'react';

import { Box } from '@mui/joy';


/**
 * LiteVideoEmbed - zero-dependency video embed (YouTube, Vimeo), replacing react-player
 * (2026-07: ~150MB of transitive deps). Privacy-first: players load from
 * youtube-nocookie.com / player.vimeo.com?dnt=1; before activation the page contacts only
 * the poster CDN (i.ytimg.com; Vimeo: one keyless oEmbed call, CORS `*`, verified 2026-07).
 *
 * Play modes:
 * - 'click' (default): poster + play button facade; the player (and its network activity)
 *   loads only on activation, and the click grants unmuted autoplay.
 * - 'auto': player mounts as soon as the element is VISIBLE, with unmuted autoplay.
 *   Browsers honor it only when the reveal follows a user interaction (e.g. expanding an
 *   accordion) - activation is delegated via allow="autoplay". Otherwise it loads paused.
 * - 'ambient': like 'auto' but MUTED - the autoplay browsers always allow. For
 *   demo/background loops (dev branch: Spotlight, Variform welcome).
 * Both immediate modes are visibility-gated (IntersectionObserver): nothing loads while
 * collapsed/offscreen.
 *
 * Sizing: `responsive` fills the parent (width/height 100%), falling back to 16:9 via
 * aspect-ratio only when the parent's height is auto (CSS ignores aspect-ratio when both
 * dimensions are definite - so parent-controlled ratios win). Or pass width/height.
 */


// configuration

const _PLATFORMS = {
  youtube: {
    playerOrigins: ['https://www.youtube-nocookie.com', 'https://www.google.com'],
    // note: YouTube's loop only works through the playlist param, and its mute param is 'mute'
    embedUrl: (videoId: string, muted: boolean, loop: boolean) => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&rel=0`
      + (muted ? '&mute=1' : '') + (loop ? `&loop=1&playlist=${encodeURIComponent(videoId)}` : ''),
    playHoverColor: '#f00',
  },
  vimeo: {
    playerOrigins: ['https://player.vimeo.com', 'https://f.vimeocdn.com'],
    embedUrl: (videoId: string, muted: boolean, loop: boolean) => `https://player.vimeo.com/video/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&dnt=1`
      + (muted ? '&muted=1' : '') + (loop ? '&loop=1' : ''),
    playHoverColor: '#00adef',
  },
} as const;

// maxres first; onError (404) or a 404-as-200 gray 120px thumb downgrades to hq
const _YT_POSTER_QUALITIES = ['maxresdefault', 'hqdefault'] as const;


// preconnect on intent (hover/focus), once per origin per session

const _preconnected = new Set<string>();

function _preconnectOrigins(origins: readonly string[]): void {
  for (const origin of origins) {
    if (_preconnected.has(origin)) continue;
    _preconnected.add(origin);
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
  }
}


export interface LiteVideoEmbedProps {
  platform: keyof typeof _PLATFORMS;
  videoId: string;
  title?: string;         // a11y label + overlay; Vimeo falls back to the oEmbed title
  play?: 'click' | 'auto' | 'ambient';
  loop?: boolean;
  rounded?: boolean;      // corner radius; off by default (parents often clip their own)
  responsive?: boolean;   // fill the parent, 16:9 fallback when the parent height is auto
  width?: number | string;
  height?: number | string;
}

export function LiteVideoEmbed(props: LiteVideoEmbedProps) {

  const { platform, videoId, play = 'click', loop, rounded, responsive, width, height } = props;
  const facade = play === 'click';

  // state
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [userActivated, setUserActivated] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [posterLoaded, setPosterLoaded] = React.useState(false);
  const [ytQualityIndex, setYtQualityIndex] = React.useState(0);
  const [vimeoOEmbed, setVimeoOEmbed] = React.useState<{ posterUrl: string, title: string } | null>(null);

  const activated = userActivated || (!facade && visible);
  const platformConfig = _PLATFORMS[platform];

  // visibility gate for the immediate modes ('auto'/'ambient'): never mount the player
  // while hidden (e.g. inside a collapsed expander - those keep children mounted, clipped
  // to zero height). For 'auto' this is also what makes unmuted autoplay work: the player
  // mounts on reveal, while the revealing click's transient activation is still fresh.
  // NOTE: gate on the clip-aware intersectionRect (real visible pixels), NOT isIntersecting,
  // which is true even for zero-height targets sitting inside a collapsed expander. The
  // extra thresholds matter: a collapsed-clipped target already sits 'at' threshold 0, so
  // only a higher ratio boundary generates the reveal callback.
  React.useEffect(() => {
    if (facade || visible || !rootRef.current) return;
    const observer = new IntersectionObserver(
      entries => entries.some(entry => entry.intersectionRect.height > 2) && setVisible(true),
      { threshold: [0, 0.05, 0.25] },
    );
    observer.observe(rootRef.current);
    return () => observer.disconnect();
  }, [facade, visible]);

  // [Vimeo] posters have no static URL: one keyless oEmbed call (also yields the title);
  // pointless when the player mounts immediately
  React.useEffect(() => {
    if (platform !== 'vimeo' || !videoId || !facade) return;
    const abort = new AbortController();
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://vimeo.com/${videoId}`)}&width=960`, { signal: abort.signal })
      .then(response => response.ok ? response.json() : null)
      .then(oEmbed => oEmbed?.thumbnail_url && setVimeoOEmbed({ posterUrl: oEmbed.thumbnail_url, title: oEmbed.title || '' }))
      .catch(() => { /* facade stays clickable on a dark background */ });
    return () => abort.abort('unmount');
  }, [facade, platform, videoId]);

  // derived
  const posterUrl = platform === 'youtube'
    ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${_YT_POSTER_QUALITIES[ytQualityIndex]}.jpg`
    : vimeoOEmbed?.posterUrl ?? null;
  const title = props.title || (platform === 'vimeo' ? vimeoOEmbed?.title : '') || '';

  // handlers
  const handleIntent = React.useCallback(() => _preconnectOrigins(platformConfig.playerOrigins), [platformConfig]);
  const handleActivate = React.useCallback(() => setUserActivated(true), []);
  const handlePosterLoad = React.useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    // [YouTube] a missing maxres poster can 200 with a gray 120x90 placeholder
    if (platform === 'youtube' && ytQualityIndex === 0 && event.currentTarget.naturalWidth <= 120)
      setYtQualityIndex(1);
    else
      setPosterLoaded(true);
  }, [platform, ytQualityIndex]);
  const handlePosterError = React.useCallback(() => {
    if (platform === 'youtube' && ytQualityIndex < _YT_POSTER_QUALITIES.length - 1)
      setYtQualityIndex(qualityIndex => qualityIndex + 1);
  }, [platform, ytQualityIndex]);

  if (!videoId) return null;

  // pre-activation renders the click-to-play facade in EVERY mode: in 'auto'/'ambient' the
  // visibility gate normally replaces it before it's ever seen, and if it doesn't (edge
  // cases, blocked autoplay), the user gets a working play button instead of a dead poster
  const showFacade = !activated;

  return (
    <Box
      ref={rootRef}
      component={showFacade ? 'button' : 'div'}
      type={showFacade ? 'button' : undefined}
      aria-label={showFacade ? (title ? `Play video: ${title}` : 'Play video') : undefined}
      onClick={showFacade ? handleActivate : undefined}
      onPointerEnter={showFacade ? handleIntent : undefined}
      onFocus={showFacade ? handleIntent : undefined}
      sx={{
        // reset (the facade is a real <button> for keyboard & screen readers)
        all: 'unset',
        boxSizing: 'border-box',
        display: 'block',
        cursor: showFacade ? 'pointer' : undefined,
        position: 'relative',
        overflow: 'hidden',
        background: 'red',
        ...(rounded && { borderRadius: 'md' }),
        // sizing: fill the parent when responsive (16:9 only if the parent height is auto),
        // otherwise explicit width/height (16:9 stands in for a missing height)
        ...(responsive
          ? { width: '100%', height: '100%', aspectRatio: '16 / 9' }
          : { width: width ?? '100%', ...(height !== undefined ? { height } : { aspectRatio: '16 / 9' }) }),
        // pre-poster skeleton: subtle dark vignette instead of a flat black box
        backgroundColor: '#101010',
        backgroundImage: 'radial-gradient(ellipse at center, #1d1d1d 0%, #101010 70%)',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'var(--joy-palette-primary-solidBg, #0B6BCB)',
          outlineOffset: '2px',
        },
        '&:hover .agi-play-badge, &:focus-visible .agi-play-badge': {
          backgroundColor: platformConfig.playHoverColor,
          transform: 'scale(1.06)',
        },
      }}
    >

      {/* poster: stays mounted under the iframe so activation never flashes black */}
      {!!posterUrl && (
        <Box
          component='img'
          src={posterUrl}
          alt=''
          draggable={false}
          decoding='async'
          onLoad={handlePosterLoad}
          onError={handlePosterError}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: posterLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      )}

      {/* title overlay, YouTube-style top gradient */}
      {showFacade && !!title && (
        <Box sx={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          padding: '0.75rem 1rem 2.5rem',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)',
          color: '#fff',
          fontSize: 'sm',
          fontWeight: 'md',
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </Box>
      )}

      {/* play badge */}
      {showFacade && (
        <Box
          className='agi-play-badge'
          aria-hidden
          sx={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: 68, height: 48,
            marginTop: '-24px', marginLeft: '-34px',
            borderRadius: '14%',
            backgroundColor: 'rgba(23, 23, 23, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s ease, transform 0.15s ease',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        >
          <svg width={24} height={24} viewBox='0 0 24 24' fill='#fff' aria-hidden='true'>
            <path d='M8 5.14v13.72c0 .8.87 1.3 1.56.9l10.98-6.86a1.05 1.05 0 0 0 0-1.8L9.56 4.24A1.05 1.05 0 0 0 8 5.14z' />
          </svg>
        </Box>
      )}

      {/* the real player: on demand ('click', unmuted via the activating gesture),
          immediate-unmuted ('auto', needs a recent gesture), or immediate-muted ('ambient') */}
      {activated && (
        <Box
          component='iframe'
          src={platformConfig.embedUrl(videoId, play === 'ambient', !!loop)}
          title={title || 'Video player'}
          allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
          allowFullScreen
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        />
      )}

    </Box>
  );
}
