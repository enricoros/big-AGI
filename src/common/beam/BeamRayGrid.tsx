import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button } from '@mui/joy';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';

import type { DLLMId } from '~/modules/llms/store-llms';

import type { BeamStoreApi } from './store-beam.hooks';
import { BeamRay, RayCard } from './BeamRay';
import { SCATTER_RAY_MAX, SCATTER_RAY_MIN } from './beam.config';


const beamRayGridDesktopSx: SxProps = {
  mx: 'var(--Pad)',
  mb: 'auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(max(min(100%, 390px), 100%/5), 1fr))',
  gap: 'var(--Pad)',
} as const;

const beamRayGridMobileSx: SxProps = {
  ...beamRayGridDesktopSx,
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
} as const;


export function BeamRayGrid(props: {
  beamStore: BeamStoreApi,
  isMobile: boolean,
  linkedLlmId: DLLMId | null,
  onIncreaseRayCount: () => void,
  rayIds: string[],
}) {

  const raysCount = props.rayIds.length;

  return (
    <Box sx={props.isMobile ? beamRayGridMobileSx : beamRayGridDesktopSx}>

      {/* Rays */}
      {props.rayIds.map((rayId) => (
        <BeamRay
          key={'ray-' + rayId}
          beamStore={props.beamStore}
          isMobile={props.isMobile}
          isRemovable={raysCount > SCATTER_RAY_MIN}
          linkedLlmId={props.linkedLlmId}
          rayId={rayId}
        />
      ))}

      {/* Add Ray */}
      {raysCount < SCATTER_RAY_MAX && (
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