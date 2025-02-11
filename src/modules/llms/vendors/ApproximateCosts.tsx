import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Chip } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { formatModelsCost } from '~/common/util/costUtils';
import { useCostMetricsForLLMService } from '~/common/stores/metrics/store-metrics';


export function ApproximateCosts(props: {
  serviceId?: DModelsServiceId,
  whoSaved?: string,
  children?: React.ReactNode,
}) {

  // state
  const [expanded, setExpanded] = React.useState(false);

  // external state
  const { totalCosts, totalSavings, totalInputTokens, totalOutputTokens, firstUsageDate, usageCount, partialMessageUsages } =
    useCostMetricsForLLMService(props.serviceId);

  const hasSaved = totalSavings && totalSavings > 0;

  return React.useMemo(() => {
    if (!totalCosts) return props.children;

    return (
      <Box sx={{
        // undo the padding of the parent
        m: 'calc(-1* var(--Card-padding))',
        mb: 0,
        p: 'var(--Card-padding)',

        // style
        fontSize: 'sm',
        backgroundColor: `${hasSaved ? 'success' : 'neutral'}.softBg`,

        // border
        borderBottom: '1px solid',
        borderBottomColor: 'divider',

        // layout
        display: 'grid',
        gap: 1
      }}>
        {expanded ? <>
          <Box>
            Approximate costs: <b>{formatModelsCost(totalCosts)}</b>
            {' · '}<span style={{ opacity: 0.75 }}>Costs are partial,
            local to this instance, and may not reflect the latest pricing.
            Starting <TimeAgo date={firstUsageDate} /> we counted {usageCount?.toLocaleString()} requests
            {(partialMessageUsages > usageCount / 10) ? ` (${partialMessageUsages} of which were partial)` : ''}
            {' '}and {(totalInputTokens + totalOutputTokens).toLocaleString()} tokens.</span>
            {/*<ExternalLink href='https://console.anthropic.com/settings/usage'>Anthropic usage</ExternalLink>*/}
            <Chip
              size='sm'
              color={hasSaved ? 'success' : 'neutral'}
              variant='outlined'
              onClick={() => setExpanded(false)}
              sx={{ ml: 1 }}
            >
              Less...
            </Chip>
          </Box>
          {!!hasSaved && <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ opacity: 0.75 }}>Thanks to Prompt Caching, </span>{props.whoSaved || 'you saved '} approximately <b>{formatModelsCost(totalSavings)}</b>.
            </div>
            {/*{advanced.on && <Button variant='outlined' size='sm' color='success' onClick={handleResetCosts}>*/}
            {/*  Reset*/}
            {/*</Button>}*/}
          </Box>}
        </> : (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <div>
              {hasSaved ? 'Spend' : 'Approximate costs'}: <b>{formatModelsCost(totalCosts)}</b>
              {!!hasSaved && <span style={{ opacity: 0.75 }}> (saved <b>{formatModelsCost(totalSavings)}</b>)</span>}
            </div>
            {' '}<Chip
              size='sm'
              color={hasSaved ? 'success' : 'neutral'}
              variant='outlined'
              onClick={() => setExpanded(true)}
              sx={{ ml: 'auto' }}
            >
              More...
            </Chip>
          </Box>
        )}
      </Box>
    );
  }, [expanded, firstUsageDate, hasSaved, partialMessageUsages, props.children, props.whoSaved, totalCosts, totalInputTokens, totalOutputTokens, totalSavings, usageCount]);
}