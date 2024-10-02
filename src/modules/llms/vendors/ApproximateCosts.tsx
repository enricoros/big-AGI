import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Alert, Box } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { formatModelsCost } from '~/common/util/costUtils';
import { useCostMetricsForLLMService } from '~/common/stores/metrics/store-metrics';


export function ApproximateCosts(props: {
  serviceId?: DModelsServiceId,
  whoSaved?: string,
  children?: React.ReactNode,
}) {

  // external state
  const { totalCosts, totalSavings, totalInputTokens, totalOutputTokens, firstUsageDate, usageCount, partialMessageUsages } =
    useCostMetricsForLLMService(props.serviceId);

  const hasSaved = totalSavings && totalSavings > 0;

  return React.useMemo(() => {
    if (!totalCosts) return props.children;

    return (
      <Alert color={hasSaved ? 'success' : undefined} sx={{ display: 'grid', gap: 1 }}>
        <Box>
          Approximate costs: <b>{formatModelsCost(totalCosts)}</b> · <span style={{ opacity: 0.75 }}>Costs are partial,
          local to this instance, and may not reflect the latest pricing.
          Starting <TimeAgo date={firstUsageDate} /> we counted {usageCount?.toLocaleString()} requests
          {(partialMessageUsages > usageCount / 10) ? ` (${partialMessageUsages} of which were partial)` : ''}
          {' '}and {(totalInputTokens + totalOutputTokens).toLocaleString()} tokens.</span>
          {/*<ExternalLink href='https://console.anthropic.com/settings/usage'>Anthropic usage</ExternalLink>*/}
        </Box>
        {!!hasSaved && <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ opacity: 0.75 }}>Thanks to Prompt Caching, </span>{props.whoSaved || 'you saved '} approximately <b>{formatModelsCost(totalSavings)}</b>.
          </div>
          {/*{advanced.on && <Button variant='outlined' size='sm' color='success' onClick={handleResetCosts}>*/}
          {/*  Reset*/}
          {/*</Button>}*/}
        </Box>}
      </Alert>
    );
  }, [totalCosts, props.children, props.whoSaved, hasSaved, firstUsageDate, usageCount, partialMessageUsages, totalInputTokens, totalOutputTokens, totalSavings]);
}