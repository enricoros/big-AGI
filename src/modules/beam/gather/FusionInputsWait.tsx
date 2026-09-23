import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Alert, Box, Button, CircularProgress, Typography } from '@mui/joy';

import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { GATHER_COLOR } from '../beam.config';
import { GatherInputsWait, gatherInputsFromRays } from './beam.gather.inputs';


/**
 * Shown while a merge waits for the replies still generating, and gone by itself once they are in.
 * Not waiting is 'Merge now' here; giving up is the Stop in the card header.
 */
export function FusionInputsWait(props: {
  beamStore: BeamStoreApi,
  inputsWait: GatherInputsWait,
}) {

  // external state
  const { pendingCount, readyCount } = useBeamStore(props.beamStore, useShallow(state => {
    const { messages, pendingCount } = gatherInputsFromRays(state.rays);
    return { pendingCount, readyCount: messages.length };
  }));

  const canMergeNow = readyCount >= 2;

  return (
    <Alert variant='outlined' sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
      {/*<CircularProgress size='sm' sx={{ '--CircularProgress-size': '16px', '--CircularProgress-trackThickness': '2px' }} />*/}
      <Typography level='body-sm' sx={{ flex: 1 }}>
        Waiting for {pendingCount === 1 ? '1 more reply' : `${pendingCount} replies`} ...
      </Typography>
      <Box sx={{ display: 'grid', gap: 0.5 }}>
        <Button color={GATHER_COLOR} disabled={!canMergeNow} onClick={props.inputsWait.mergeNow}>
          {canMergeNow ? `Proceed with ${readyCount} now` : 'Proceed now'}
        </Button>
        {!canMergeNow && <Typography level='body-xs' sx={{ textAlign: 'center' }}>
          (need at least 2)
        </Typography>}
      </Box>
    </Alert>
  );
}
