import * as React from 'react';
import { useMutation } from '@tanstack/react-query';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, CircularProgress } from '@mui/joy';
import LinkIcon from '@mui/icons-material/Link';

import type { ContentScaling } from '~/common/app.theme';


const containerSx: SxProps = {
  mt: -1,
  ml: 1.5,
  mb: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
} as const;


/**
 * Discreet bottom-of-message action: resolves Vertex AI grounding redirect links in place.
 * Disappears naturally once resolved, as the links no longer match the redirect pattern.
 */
export function BlockOpResolveLinks(props: {
  contentScaling: ContentScaling,
  linksCount: number,
  onResolve: () => Promise<string | undefined>, // returns an error message on failure, undefined on success
}) {

  // one-shot mutation: throw the returned message so it surfaces as `error` (and `isError`)
  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: async () => {
      const errorText = await props.onResolve();
      if (errorText) throw new Error(errorText);
    },
  });

  const plural = props.linksCount !== 1 ? 's' : '';

  return (
    <Box sx={containerSx}>
      <Chip
        size='sm'
        color={isError ? 'warning' : 'primary'}
        variant='soft'
        disabled={isPending}
        onClick={isPending ? undefined : () => mutate()}
        startDecorator={isPending ? <CircularProgress size='sm' /> : <LinkIcon />}
        sx={{
          // copied from BLockPartModelAux._styles.chip
          minHeight: '1.5rem',
          pl: 1.5,
          pr: 1.75,
          // my: '1px',
          // outline: '1px solid',
          fontSize: props.contentScaling,
          // outlineColor: 'primary.outlineBorder',
          // boxShadow: `1px 2px 4px -3px var(--joy-palette-primary-solidBg)`,
        }}
      >
        {isPending ? `Resolving ${props.linksCount} link${plural}...`
          : isError ? error.message /* the handler's message carries its own hint (e.g. '- retry' only when retrying helps) */
            : `Resolve ${props.linksCount} Vertex AI link${plural}`}
      </Chip>
    </Box>
  );
}
