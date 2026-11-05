import * as React from 'react';
import { useMutation } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, CircularProgress } from '@mui/joy';
import LinkIcon from '@mui/icons-material/Link';

import { vertexLinksResolveFragments } from '~/modules/google/vertexai.client';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragment, DMessageFragmentId } from '~/common/stores/chat/chat.fragments';


const containerSx: SxProps = {
  mt: -1,
  ml: 1.5,
  mb: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
} as const;


/** Bottom-of-message action: resolves the message's Vertex AI grounding redirect links in place. */
export function BlockOpResolveVertexAILinks(props: {
  contentScaling: ContentScaling,
  fragments: readonly DMessageFragment[],
  linksCount: number,
  onFragmentReplace: (fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void,
}) {

  const { mutate, isPending, data: issue } = useMutation({
    mutationFn: async () => {
      const { rewritten, unresolved } = await vertexLinksResolveFragments(props.fragments);
      for (const fragment of rewritten) props.onFragmentReplace(fragment.fId, fragment);
      return !unresolved.size ? null
        : [...unresolved.values()].some(({ outcome }) => outcome === 'unknown') ? 'Could not resolve - retry'
          : 'Expired or invalid links';
    },
  });

  const plural = props.linksCount !== 1 ? 's' : '';

  return (
    <Box sx={containerSx}>
      <Chip
        size='sm'
        color={issue ? 'warning' : 'primary'}
        variant='soft'
        disabled={isPending}
        onClick={() => mutate()}
        startDecorator={isPending ? <CircularProgress size='sm' /> : <LinkIcon />}
        sx={{ minHeight: '1.5rem', pl: 1.5, pr: 1.75, fontSize: props.contentScaling }}
      >
        {isPending ? `Resolving ${props.linksCount} link${plural}...` : issue ?? `Resolve ${props.linksCount} Vertex AI link${plural}`}
      </Chip>
    </Box>
  );
}
