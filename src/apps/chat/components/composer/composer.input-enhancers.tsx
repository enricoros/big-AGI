import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, IconButton, Tooltip, Typography } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { extractYoutubeVideoIDFromURL } from '~/modules/youtube/youtube.utils';

import type { AttachmentEnhancerHintItem, AttachmentInputEnhancer } from '~/common/attachment-drafts/attachment.enhancers';
import { EditorialVideoInput, llmsEditorialVideoInputPick } from '~/common/stores/llms/model.domains.editorial';
import { LLM_IF_Inputs_Video } from '~/common/stores/llms/llms.types';
import { asValidURL } from '~/common/util/urlUtils';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { setPrimaryChatModelId } from '~/common/stores/llms/hooks/useModelDomain';
import { useModelsStore } from '~/common/stores/llms/store-llms';


/**
 * The Composer's input enhancers - a STATIC list (module-scope, referentially stable) with its
 * implementations fused in. Other surfaces compose their own lists; when a second surface wants
 * one of these, extract it - not before.
 */


/// Video URL enhancer ///

// direct media URLs: extension -> MIME, aligned with the Gemini-supported video formats
const _VIDEO_EXT_TO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpg',
  '.mov': 'video/quicktime',
  '.avi': 'video/avi',
  '.flv': 'video/x-flv',
  '.webm': 'video/webm',
  '.wmv': 'video/wmv',
  '.3gp': 'video/3gpp',
};


function _matchVideoUrl(text: string): { url: string, mimeType?: string, youTubeVideoId?: string } | null {

  // must be a URL at all
  if (!asValidURL(text)) return null;

  // YouTube (any accepted form) - normalize to the canonical watch URL
  const youTubeVideoId = extractYoutubeVideoIDFromURL(text);
  if (youTubeVideoId)
    return { url: `https://www.youtube.com/watch?v=${youTubeVideoId}`, youTubeVideoId };

  // direct video file URL, by extension (EXPERIMENTAL: works on Gemini, but token accounting upstream is opaque)
  try {
    const pathname = new URL(text).pathname.toLowerCase();
    for (const [ext, mimeType] of Object.entries(_VIDEO_EXT_TO_MIME))
      if (pathname.endsWith(ext))
        return { url: text, mimeType };
  } catch {
    // invalid URL object - fall through
  }

  return null;
}


const _chipSx: SxProps = {
  // style matched to the composer's InReferenceToBubble (incl. width: 100% - the grid row would
  // otherwise let a long URL overflow instead of ellipsizing)
  backgroundColor: 'background.surface',
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'sm',
  boxShadow: 'xs',
  padding: '0.25rem 0.25rem 0.25rem 0.5rem',

  // layout
  width: '100%',
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

const _thumbSx: SxProps = {
  width: 48,
  height: 36,
  objectFit: 'cover',
  borderRadius: 'xs',
  flexShrink: 0,
} as const;

function VideoUrlPendingChip(props: { part: Parameters<AttachmentInputEnhancer['ownsPart']>[0], onRemove: () => void }) {

  const resource = props.part.resource;
  const youTubeVideoId = extractYoutubeVideoIDFromURL(resource.url);

  return (
    <Box sx={_chipSx}>

      {youTubeVideoId ? (
        // zero-network-cost thumbnail, derived from the video id
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://i.ytimg.com/vi/${youTubeVideoId}/default.jpg`} alt='Video' style={_thumbSx as React.CSSProperties} />
      ) : (
        <PlayArrowRoundedIcon sx={{ fontSize: 'xl2', color: 'primary.solidBg', flexShrink: 0 }} />
      )}

      {/* icon as a sibling, NOT a Typography startDecorator: the decorator turns Typography into a
          flex container, and text-overflow stops applying to the inner text (clip, no ellipsis) */}
      {!!youTubeVideoId && <YouTubeIcon sx={{ color: 'red', flexShrink: 0 }} />}

      <Tooltip disableInteractive arrow title='Video attached - the AI will watch it' placement='top'>
        <Typography level='body-sm' className='agi-ellipsize' sx={{ flex: 1, minWidth: 0 }}>
          {resource.url.replace(/^https?:\/\/(www\.)?/, '')}
        </Typography>
      </Tooltip>

      <IconButton size='sm' onClick={props.onRemove} sx={{ flexShrink: 0, background: 'none' }}>
        <CloseRoundedIcon />
      </IconButton>

    </Box>
  );
}


/** Capability hint: a video URL was pasted on a non-video model - offer the editorial pick, or Models setup. */
function VideoUrlDisabledHint(props: AttachmentEnhancerHintItem) {

  // reactive: upgrades in-place from the setup pointer when the user adds a capable model (e.g. via the Models button)
  const candidate = useModelsStore(state => llmsEditorialVideoInputPick(state.llms));

  const youTubeVideoId = extractYoutubeVideoIDFromURL(props.part.resource.url);

  const handleSwitchAndConvert = () => {
    if (!candidate) return;
    setPrimaryChatModelId(candidate.id);
    props.onConvert();
  };

  return (
    <Box sx={_chipSx}>

      {youTubeVideoId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`https://i.ytimg.com/vi/${youTubeVideoId}/default.jpg`} alt='Video' style={_thumbSx as React.CSSProperties} />
      ) : (
        <PlayArrowRoundedIcon sx={{ fontSize: 'xl2', color: 'primary.solidBg', flexShrink: 0 }} />
      )}

      <Typography level='body-sm' className='agi-ellipsize' sx={{ flex: 1, minWidth: 0 }}>
        {candidate ? EditorialVideoInput.hintSwitch : EditorialVideoInput.hintSetup}
      </Typography>

      <Button size='sm' color='neutral' onClick={candidate ? handleSwitchAndConvert : optimaOpenModels} sx={{ flexShrink: 0 }}>
        {candidate ? EditorialVideoInput.actionSwitch(candidate.label) : EditorialVideoInput.actionSetup}
      </Button>

      <IconButton size='sm' onClick={props.onDismiss} sx={{ flexShrink: 0, background: 'none' }}>
        <CloseRoundedIcon />
      </IconButton>

    </Box>
  );
}


// module-scope singleton: referentially stable
const videoUrlInputEnhancer: AttachmentInputEnhancer = {

  id: 'video-url',

  isEnabled: (llm) => !!llm?.interfaces?.includes(LLM_IF_Inputs_Video),

  placeholderHint: () => 'paste a video link',

  interceptText: (text) => {
    const match = _matchVideoUrl(text);
    return !match ? null : { pt: 'hosted_resource', resource: { via: 'url', url: match.url, mediaKind: 'video', ...(match.mimeType ? { mimeType: match.mimeType } : {}) } };
  },

  ownsPart: (part) => part.resource.mediaKind === 'video',

  PendingChip: VideoUrlPendingChip,

  DisabledMatchHint: VideoUrlDisabledHint,

};


/// The Composer's list ///

export const COMPOSER_INPUT_ENHANCERS: readonly AttachmentInputEnhancer[] = [
  videoUrlInputEnhancer,
];
