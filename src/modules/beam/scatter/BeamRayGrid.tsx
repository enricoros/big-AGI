import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button } from '@mui/joy';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';

import type { BeamStoreApi } from '../store-beam.hooks';
import { BeamCard } from '../BeamCard';
import { SCATTER_RAY_MAX, SCATTER_RAY_MIN } from '../beam.config';

import { BeamRay } from './BeamRay';


const rayGridDesktopSx: SxProps = {
  mx: 'var(--Pad)',
  mb: 'auto',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(max(min(100%, 390px), 100%/5), 1fr))',
  gap: 'var(--Pad)',
} as const;

const rayGridMobileSx: SxProps = {
  ...rayGridDesktopSx,
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
} as const;


export function BeamRayGrid(props: {
  beamStore: BeamStoreApi,
  hadImportedRays: boolean
  isMobile: boolean,
  onIncreaseRayCount: () => void,
  rayIds: string[],
  // linkedLlmId: DLLMId | null,
}) {

  const raysCount = props.rayIds.length;

  return (
    <Box sx={props.isMobile ? rayGridMobileSx : rayGridDesktopSx}>

      {/* Rays */}
      {props.rayIds.map((rayId, index) => (
        <BeamRay
          key={'ray-' + rayId}
          rayIndexWeak={index}
          beamStore={props.beamStore}
          hadImportedRays={props.hadImportedRays}
          isRemovable={raysCount > SCATTER_RAY_MIN}
          rayId={rayId}
          // linkedLlmId={props.linkedLlmId}
        />
      ))}

      {/* Add Ray */}
      {raysCount < SCATTER_RAY_MAX && (
        <BeamCard sx={{ mb: 'auto' }}>
          <Button variant='plain' color='neutral' onClick={props.onIncreaseRayCount} sx={{
            minHeight: 'calc(2 * var(--Card-padding) + 2rem - 0.5rem)',
            marginBlock: 'calc(-1 * var(--Card-padding) + 0.25rem)',
            marginInline: 'calc(-1 * var(--Card-padding) + 0.375rem)',
            // justifyContent: 'end',
          }}>
            <AddCircleOutlineRoundedIcon />
          </Button>
        </BeamCard>
      )}

      {/*/!* Takes a full row *!/*/}
      {/*<Divider sx={{*/}
      {/*  gridColumn: '1 / -1',*/}
      {/*  // marginBlock: 'var(--Pad)',*/}
      {/*}}>*/}
      {/*  Merges*/}
      {/*</Divider>*/}

      {/* Fusions */}
      {/*{props.fusionIds.map((fusionId) => (*/}
      {/*  <BeamFusion*/}
      {/*    key={'fusion-' + fusionId}*/}
      {/*    beamStore={props.beamStore}*/}
      {/*    fusionId={fusionId}*/}
      {/*  />*/}
      {/*))}*/}

      {/* Add Fusion */}
      {/*<BeamFusionAdd*/}
      {/*  beamStore={props.beamStore}*/}
      {/*  isMobile={props.isMobile}*/}
      {/*/>*/}

    </Box>
  );
}