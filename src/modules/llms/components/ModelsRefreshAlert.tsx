import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, CircularProgress, IconButton } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { optimaOpenModelsUpdates } from '~/common/layout/optima/useOptima';

import { llmsRefreshAllServices, useModelsRefreshBatchStore, useModelsRefreshSummary } from '../llm.client.refresh';


/** Starts the refresh session of every eligible service; disabled with a spinner while one runs. */
export function ModelsRefreshIconButton(props: { sx?: SxProps }) {
  const isRunning = useModelsRefreshBatchStore(state => state.runningAt !== null);
  return (
    <TooltipOutlined title='Update the models of all services'>
      <IconButton variant='outlined' disabled={isRunning} onClick={() => void llmsRefreshAllServices('app-settings')} aria-label='Update all models' sx={props.sx}>
        {isRunning ? <CircularProgress size='sm' /> : <RefreshIcon />}
      </IconButton>
    </TooltipOutlined>
  );
}

/**
 * One-line status of the refresh session, while it runs and after it ends (until something newer is logged).
 * Clicking opens the AI Models dialog on the Updates screen.
 */
export function ModelsRefreshAlert() {

  const summary = useModelsRefreshSummary();

  const handleOpenUpdates = React.useCallback(() => optimaOpenModelsUpdates(), []);

  // only for sessions the user started (the boot refresh runs on its own, and would greet every Preferences visit)
  if (summary.state === 'idle' || summary.via === 'boot')
    return null;

  const running = summary.state === 'running';
  const text = running
    ? `Updating ${Math.min(summary.done + 1, summary.total)} of ${summary.total} services...`
    : summary.upToDate
      ? 'All models are up to date'
      : 'Models updated: ' + [
        [summary.added && `${summary.added} added`, summary.changed && `${summary.changed} changed`, summary.removed && `${summary.removed} removed`].filter(Boolean).join(', ') || 'no model changes',
        summary.failed && `${summary.failed} ${summary.failed === 1 ? 'service' : 'services'} failed`,
      ].filter(Boolean).join('; ');

  const color = !running && summary.failed ? 'warning' : 'primary';

  return (
    <Alert
      tabIndex={0}
      color={color}
      startDecorator={running ? <CircularProgress size='sm' sx={{ '--CircularProgress-size': '20px', '--CircularProgress-thickness': '2px' }} /> : summary.failed ? <WarningRoundedIcon /> : <CheckRoundedIcon />}
      endDecorator={<KeyboardArrowRightIcon />}
      onClick={handleOpenUpdates}
      sx={{
        boxShadow: `inset 1px 1px 4px -3px var(--joy-palette-${color}-solidHoverBg)`,
        // mt: -1,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: `${color}.outlinedBorder`,
        '&:hover': { backgroundColor: `${color}.softHoverBg` },
      }}
    >
      {text}
    </Alert>
  );
}
