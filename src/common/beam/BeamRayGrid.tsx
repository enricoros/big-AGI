import * as React from 'react';

import { Box, Button } from '@mui/joy';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';

import type { DLLMId } from '~/modules/llms/store-llms';

import { BeamRay, RayCard } from './BeamRay';


// component configuration
export const MIN_RAY_COUNT = 1;
export const DEF_RAY_COUNT = 2;
export const MAX_RAY_COUNT = 8;
export const CONTROLS_RAY_PRESETS = [2, 4, 8];


export function BeamRayGrid(props: {
  beamStore: any,
  gatherLlmId: DLLMId | null,
  isMobile: boolean,
  rayIds: string[],
  onIncreaseRayCount: () => void,
}) {

  const raysCount = props.rayIds.length;


  return (
    <Box sx={{
      mx: 'var(--Pad)',
      mb: 'auto',
      display: 'grid',
      gridTemplateColumns: props.isMobile ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
      gap: 'var(--Pad)',
    }}>

      {props.rayIds.map((rayId) => (
        <BeamRay
          key={'ray-' + rayId}
          beamStore={props.beamStore}
          rayId={rayId}
          isMobile={props.isMobile}
          isRemovable={raysCount > MIN_RAY_COUNT}
          gatherLlmId={props.gatherLlmId}
        />
      ))}

      {/* Add Ray */}
      {raysCount < MAX_RAY_COUNT && (
        <RayCard sx={{ mb: 'auto' }}>
          <Button variant='plain' color='neutral' onClick={props.onIncreaseRayCount} sx={{
            minHeight: 'calc(2 * var(--Card-padding) + 2rem - 0.5rem)',
            marginBlock: 'calc(-1 * var(--Card-padding) + 0.25rem)',
            marginInline: 'calc(-1 * var(--Card-padding) + 0.375rem)',
            // justifyContent: 'end',
          }}>
            <AddCircleOutlineRoundedIcon />
          </Button>
        </RayCard>
      )}

    </Box>
  );
}