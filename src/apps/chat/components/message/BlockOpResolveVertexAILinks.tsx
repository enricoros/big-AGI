import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Chip, CircularProgress } from '@mui/joy';
import LinkIcon from '@mui/icons-material/Link';

import { vertexAILinks } from '~/modules/google/vertexai.client';

import type { ContentScaling } from '~/common/app.theme';
import type { DMessageFragment, DMessageFragmentId, DVoidFragmentModelAnnotations } from '~/common/stores/chat/chat.fragments';


const containerSx: SxProps = {
  mt: -1,
  ml: 1.5,
  mb: 1,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
} as const;

type _ResolveIssue = 'expired' | 'failed';

const _issueText: Record<_ResolveIssue, string> = {
  expired: 'Links may have expired',   // no redirect anymore: retrying won't help
  failed: 'Could not resolve - retry', // no answer in time: network or deadline
} as const;


/**
 * Discreet bottom-of-message action: resolves the Vertex AI grounding redirect links the completion pass left in the
 * citations fragments, through the host's fragment replace. Renders nothing once none is left.
 */
export function BlockOpResolveVertexAILinks(props: {
  contentScaling: ContentScaling,
  citations: readonly DVoidFragmentModelAnnotations[],
  onFragmentReplace: (fragmentId: DMessageFragmentId, newFragment: DMessageFragment) => void,
}) {

  const { citations, onFragmentReplace } = props;

  // state
  const [isResolving, setIsResolving] = React.useState(false);
  const [issue, setIssue] = React.useState<_ResolveIssue | null>(null);

  // derived
  const unresolvedCount = React.useMemo(() => vertexAILinks.unresolvedUrls(citations).size, [citations]);

  const handleResolve = React.useCallback(async () => {
    setIsResolving(true);
    setIssue(null);
    try {
      const { replacements, resolution } = await vertexAILinks.resolveCitations(citations);
      for (const [fragmentId, fragment] of replacements) onFragmentReplace(fragmentId, fragment);
      setIssue(resolution.unknown.size ? 'failed' : resolution.expired.size ? 'expired' : null);
    } finally {
      setIsResolving(false);
    }
  }, [citations, onFragmentReplace]);

  if (!unresolvedCount)
    return null;

  const plural = unresolvedCount !== 1 ? 's' : '';

  return (
    <Box sx={containerSx}>
      <Chip
        size='sm'
        color={issue ? 'warning' : 'primary'}
        variant='soft'
        disabled={isResolving}
        onClick={isResolving ? undefined : handleResolve}
        startDecorator={isResolving ? <CircularProgress size='sm' /> : <LinkIcon />}
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
        {isResolving ? `Resolving ${unresolvedCount} link${plural}...`
          : issue ? _issueText[issue]
            : `Resolve ${unresolvedCount} Vertex AI link${plural}`}
      </Chip>
    </Box>
  );
}
