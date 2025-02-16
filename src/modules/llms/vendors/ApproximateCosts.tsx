import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, Chip } from '@mui/joy';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { formatModelsCost } from '~/common/util/costUtils';
import { useCostMetricsForLLMService } from '~/common/stores/metrics/store-metrics';
import { useIsMobile } from '~/common/components/useMatchMedia';


const _styles = {

  box: {
    // undo the padding of the parent
    m: 'calc(-1* var(--Card-padding))',
    mb: 0,
    p: 'var(--Card-padding)',

    // style
    fontSize: 'sm',
    backgroundColor: 'neutral.softBg',
    // boxShadow: 'inset 0px 1px 4px -2px rgba(0, 0, 0, 0.2)',

    // border
    borderBottom: '1px solid',
    borderBottomColor: 'divider',

    // layout
    display: 'grid',
    gap: 1,
  } as const,

  showCollapsed: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 1,
  } as const,

  chipLess: {
    ml: 1,
  } as const,

  chipMore: {
    ml: 'auto',
  } as const,

} as const;

export function ApproximateCosts(props: {
  serviceId?: DModelsServiceId,
  whoSaved?: string,
  children?: React.ReactNode,
}) {

  // state
  const [expanded, setExpanded] = React.useState(false);

  // external state
  const isMobile = useIsMobile();
  const { totalCosts, totalSavings, totalInputTokens, totalOutputTokens, firstUsageDate, usageCount, partialMessageUsages } =
    useCostMetricsForLLMService(props.serviceId);

  const hasSaved = totalSavings && totalSavings > 0;

  return React.useMemo(() => {
    if (!totalCosts)
      return !props.children ? undefined
        : <Box sx={_styles.box}>{props.children}</Box>;

    return (
      <Box sx={_styles.box}>
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
              sx={_styles.chipLess}
            >
              Less...
            </Chip>
          </Box>
          {!!hasSaved && <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box component='span' sx={{ color: 'success.plainColor' }}>Thanks to {props.whoSaved ? 'smart caching' : 'caching'}, {props.whoSaved || 'you saved '} approximately <b>{formatModelsCost(totalSavings)}</b>.</Box>
            {/*{advanced.on && <Button variant='outlined' size='sm' color='success' onClick={handleResetCosts}>*/}
            {/*  Reset*/}
            {/*</Button>}*/}
          </Box>}
        </> : (
          <Box sx={_styles.showCollapsed}>
            <div>
              {(hasSaved && isMobile) ? 'Spend' : 'Approximate costs'}: <b>{formatModelsCost(totalCosts)}</b>
              {!!hasSaved && <> · saved <Box component='span' sx={{ color: 'success.plainColor' }}><b>{formatModelsCost(totalSavings)}</b></Box></>}
            </div>
            {' '}<Chip
            size='sm'
            color={hasSaved ? 'success' : 'neutral'}
            variant='outlined'
            onClick={() => setExpanded(true)}
            sx={_styles.chipMore}
          >
            More...
          </Chip>
          </Box>
        )}
      </Box>
    );
  }, [expanded, firstUsageDate, hasSaved, isMobile, partialMessageUsages, props.children, props.whoSaved, totalCosts, totalInputTokens, totalOutputTokens, totalSavings, usageCount]);
}