import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { ColorPaletteProp, SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';

import { animationColorBeamGather } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { FFactoryId, FUSION_FACTORIES } from './instructions/beam.gather.factories';
import { GATHER_COLOR } from '../beam.config';
import { beamPaneSx } from '../BeamCard';
import { useModuleBeamStore } from '../store-module-beam';


const gatherPaneClasses = {
  busy: 'gatherPane-Busy',
  ready: 'gatherPane-Ready',
};

const gatherPaneSx: SxProps = {
  ...beamPaneSx,
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  backgroundColor: 'background.surface',
  boxShadow: `0px 6px 20px -8px rgb(var(--joy-palette-neutral-darkChannel) / 30%)`,
  [`&.${gatherPaneClasses.ready}`]: {
    backgroundColor: 'background.popup',
    // boxShadow: `0px 6px 16px -8px rgb(var(--joy-palette-success-darkChannel) / 40%)`,
  },
  [`&.${gatherPaneClasses.busy}`]: {
    // animation: `${animationShadowRingLimey} 2s linear infinite`,
  },
};

const mobileGatherPaneSx: SxProps = {
  ...gatherPaneSx,

  // [mobile] larger gap in between rows, as on mobile we have a smaller gap
  rowGap: 'var(--Pad)',
};

const desktopGatherPaneSx: SxProps = {
  ...gatherPaneSx,

  // [desktop] keep visible at the bottom
  position: 'sticky',
  bottom: 0,
  top: 0,
};


export function BeamGatherPane(props: {
  beamStore: BeamStoreApi,
  canGather: boolean,
  isMobile: boolean,
  // onAddFusion: () => void,
  raysReady: number,
}) {


  // external state
  // const { setStickToBottom } = useScrollToBottom();
  const {
    currentFactoryId, currentGatherLlmId, isGatheringAny, hasFusions,
    setCurrentFactoryId, setCurrentGatherLlmId,
  } = useBeamStore(props.beamStore, useShallow(state => ({
    // state
    // currentFactory: findFusionFactory(state.currentFactoryId),
    currentFactoryId: state.currentFactoryId,
    currentGatherLlmId: state.currentGatherLlmId,
    isGatheringAny: state.isGatheringAny,
    hasFusions: state.fusions.length > 0,

    // actions
    setCurrentFactoryId: state.setCurrentFactoryId,
    setCurrentGatherLlmId: state.setCurrentGatherLlmId,
  })));
  const gatherAutoStartAfterScatter = useModuleBeamStore(state => state.gatherAutoStartAfterScatter);
  const disableUnlessAutoStart = !props.canGather && !gatherAutoStartAfterScatter;
  const [_, gatherLlmComponent/*, gatherLlmIcon*/] = useLLMSelect(
    currentGatherLlmId, setCurrentGatherLlmId, props.isMobile ? '' : 'Merge Model', true, disableUnlessAutoStart,
  );

  // derived state
  // const isNoFactorySelected = currentFactoryId === null;

  // const CurrentFactoryIcon = currentFactory?.Icon ?? null;
  // const currentFactoryDescription = currentFactory?.description ?? '';

  const handleFactoryActivate = React.useCallback((factoryId: FFactoryId, shiftPressed: boolean) => {
    // setStickToBottom(true);
    setCurrentFactoryId((factoryId !== currentFactoryId || !shiftPressed) ? factoryId : null);
  }, [currentFactoryId, setCurrentFactoryId]);


  const MainLlmIcon = /*gatherLlmIcon ||*/ (isGatheringAny ? AutoAwesomeIcon : AutoAwesomeOutlinedIcon);

  return (
    <Box
      className={`${props.canGather ? gatherPaneClasses.ready : ''} ${isGatheringAny ? gatherPaneClasses.busy : ''}`}
      sx={props.isMobile ? mobileGatherPaneSx : desktopGatherPaneSx}
    >

      {/* Title */}
      <Box>
        <Typography
          level='h4' component='h3'
          // endDecorator={<ScrollToBottomButton inline />}
          // sx={{ my: 0.25 }}
          sx={(props.canGather || hasFusions || isGatheringAny) ? undefined : { color: 'primary.solidDisabledColor', ['& > svg']: { color: 'primary.solidDisabledColor' } }}
        >
          <MainLlmIcon sx={{ fontSize: '1rem', mr: 0.625, animation: isGatheringAny ? `${animationColorBeamGather} 2s linear infinite` : undefined }} />
          Merge
        </Typography>
        <Typography level='body-sm' sx={{ whiteSpace: 'nowrap' }}>
          {/* may merge or not (hasInputs) N replies.. put this in pretty messages */}
          {props.canGather ? `Combine the ${props.raysReady} replies` : /*'Fuse all replies'*/ ''}
        </Typography>
      </Box>

      {/* Method */}
      <FormControl sx={{ my: '-0.25rem' }}>
        {/*{!props.isMobile && <FormLabelStart title='Method' />}*/}
        <ButtonGroup
          variant='outlined'
          size='md'
          disabled={disableUnlessAutoStart}
          // sx={{ boxShadow: isNoFactorySelected ? 'xs' : undefined }}
        >
          {FUSION_FACTORIES.map(factory => {
            const { factoryId, shortLabel } = factory;
            const isActive = factoryId === currentFactoryId;
            const buttonColor: ColorPaletteProp = isActive ? GATHER_COLOR : 'neutral';
            return (
              <Button
                key={'factory-' + factoryId}
                color={buttonColor}
                onClick={event => handleFactoryActivate(factoryId, !!event?.shiftKey)}
                // startDecorator={(isActive && Icon) ? <Icon /> : null}
                sx={{
                  backgroundColor: isActive ? `${buttonColor}.softBg` : 'background.popup',
                  // fontWeight: isActive ? 'lg' : 'md', /* reset, from 600 */
                  // minHeight: '2.25rem',
                }}
              >
                {shortLabel}
              </Button>
            );
          })}
        </ButtonGroup>
      </FormControl>

      {/* LLM */}
      <Box sx={{ my: '-0.25rem', minWidth: 190, maxWidth: 300 }}>
        {gatherLlmComponent}
      </Box>

      {/* Add Fusion */}
      {/*<FusionAddButton*/}
      {/*  textOverride='Add'*/}
      {/*  canGather={props.canGather}*/}
      {/*  currentFactory={currentFactory}*/}
      {/*  onAddFusion={props.onAddFusion}*/}
      {/*  sx={BEAM_BTN_SX}*/}
      {/*/>*/}

      {/* pad */}
      <Box />

    </Box>
  );
}