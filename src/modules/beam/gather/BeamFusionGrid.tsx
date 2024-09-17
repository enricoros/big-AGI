import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps, VariantProp } from '@mui/joy/styles/types';
import { Alert, Box, Button, Typography, useTheme } from '@mui/joy';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import LanguageIcon from '@mui/icons-material/Language';

import { BrowserLang } from '~/common/util/pwaUtils';

import { Fusion } from './Fusion';
import { findFusionFactory, FusionFactorySpec } from './instructions/beam.gather.factories';

import { BeamCard, beamCardClasses } from '../BeamCard';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { GATHER_COLOR } from '../beam.config';


const fusionGridDesktopSx: SxProps = {
  mt: 'calc(-1 * var(--Pad))', // absorb parent 'gap' to previous

  px: 'var(--Pad)',
  pb: 'var(--Pad)',
  // backgroundColor: 'neutral.solidBg',
  // mb:'auto',

  // like rayGridDesktopSx
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(max(min(100%, 390px), 100%/5), 1fr))',
  gap: 'var(--Pad)',
} as const;

const fusionGridMobileSx: SxProps = {
  ...fusionGridDesktopSx,
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
} as const;


export function FusionAddButton(props: {
  canGather: boolean,
  currentFactory: FusionFactorySpec | null,
  onAddFusion: () => void,
  sx?: SxProps,
  small?: boolean,
  textOverride?: string,
  variant?: VariantProp,
}) {
  if (props.currentFactory === null) return null;
  return (
    <Button
      size={props.small ? 'sm' : undefined}
      color={GATHER_COLOR}
      variant={props.variant}
      disabled={!props.canGather}
      onClick={props.onAddFusion}
      startDecorator={props.currentFactory?.Icon ? <props.currentFactory.Icon /> : <AddCircleOutlineRoundedIcon />}
      sx={{
        // justifyContent: 'end',
        // gap: 1,
        ...props.sx,
      }}
    >
      {props.textOverride || props.currentFactory?.addLabel}
    </Button>
  );
}


export function BeamFusionGrid(props: {
  beamStore: BeamStoreApi,
  canGather: boolean,
  fusionIds: string[],
  isMobile: boolean,
  onAddFusion: () => void,
  raysCount: number,
}) {

  // external state
  const {
    currentFactory,
  } = useBeamStore(props.beamStore, useShallow(state => ({
    currentFactory: findFusionFactory(state.currentFactoryId),
  })));
  const isDarkMode = useTheme().palette.mode === 'dark';


  // derived state
  const isEmpty = props.fusionIds.length === 0;
  const isNoFactorySelected = currentFactory === null;


  // to balance things out with the ray grid, we may need to pad the items
  // const targetCount = props.raysCount + 1;
  // const fusionCount = props.fusionIds.length + 1;
  // // const padItems = targetCount - fusionCount;
  // const padItems = 1;

  return (
    <Box sx={{
      ...(props.isMobile ? fusionGridMobileSx : fusionGridDesktopSx),
      ...(isEmpty ? {
        backgroundColor: 'neutral.solidBg',
      } : {
        backgroundColor: isDarkMode ? 'success.900' : '#F2FFFA', // f8fff8 was good, too close to the gree hue
        pt: 'var(--Pad)',
      }),
    }}>

      {/* Fusions */}
      {props.fusionIds.map((fusionId) => (
        <Fusion
          key={'fusion-' + fusionId}
          beamStore={props.beamStore}
          fusionId={fusionId}
          isMobile={props.isMobile}
        />
      ))}

      {/* Add Fusion (Card) */}
      {(isEmpty || !isNoFactorySelected) && (
        <BeamCard
          className={isEmpty ? beamCardClasses.smashTop : undefined}
          sx={{
            backgroundColor: props.canGather ? `${GATHER_COLOR}.softBg` : undefined,
            // boxShadow: `0px 6px 16px -12px rgb(var(--joy-palette-${props.canGather ? GATHER_COLOR : 'neutral'}-darkChannel) / 40%)`,
            mb: 'auto',
          }}
        >
          {isNoFactorySelected ? null : props.canGather ? <Box sx={{ display: 'flex', flexDirection: props.isMobile ? 'column-reverse' : undefined, alignItems: props.isMobile ? undefined : 'center', gap: 1 }}>

            <FusionAddButton
              // small
              // variant='soft'
              canGather={props.canGather}
              currentFactory={currentFactory}
              onAddFusion={props.onAddFusion}
              sx={{
                minHeight: props.isMobile ? 'calc(2 * var(--Card-padding) + 2rem - 0.5rem)' : undefined,
                // marginBottom: 'calc(-1 * var(--Card-padding) + 0.25rem)',
                // marginInline: 'calc(-1 * var(--Card-padding) + 0.375rem)',
                whiteSpace: 'nowrap',
              }}
            />

            <Typography level='body-sm' variant='soft' color={GATHER_COLOR}>
              {currentFactory.description}
            </Typography>

          </Box> : (
            <Typography level='body-sm' sx={{ opacity: 0.8 }}>
              {/*You need two or more replies for a {currentFactory?.shortLabel?.toLocaleLowerCase() ?? ''} merge.*/}
              Waiting for multiple responses.
            </Typography>
          )}
        </BeamCard>
      )}

      {/* Full-width warning if not */}
      {BrowserLang.notUS && (
        <Alert color='warning' sx={{
          // full row of the grid
          gridColumn: '1 / -1',
        }}>
          <Typography level='body-sm' color='warning' startDecorator={<LanguageIcon />}>
            Note: Merges are defined in English and have not been translated to your browser language ({navigator.language}) yet.
          </Typography>
        </Alert>
      )}

      {/* Pad items: N * <Box/> */}
      {/*{padItems > 0 && (*/}
      {/*  Array.from({ length: padItems }).map((_, index) => (*/}
      {/*    <Box key={'pad-' + index} />*/}
      {/*  ))*/}
      {/*)}*/}

    </Box>
  );
}