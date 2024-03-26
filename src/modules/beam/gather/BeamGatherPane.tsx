import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { ColorPaletteProp, SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, CircularProgress, FormControl, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeMotionTwoToneIcon from '@mui/icons-material/AutoAwesomeMotionTwoTone';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import MergeRoundedIcon from '@mui/icons-material/MergeRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { animationColorBeamGather, animationShadowRingLimey } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { BEAM_BTN_SX, GATHER_COLOR } from '../beam.config';
import { BeamGatherDropdown } from './BeamGatherPaneDropdown';
import { BeamStoreApi, useBeamStore } from '../store-beam.hooks';
import { FUSION_FACTORIES } from './instructions/beam.gather.factories';
import { beamPaneSx } from '../BeamCard';
import { fusionIsFusing, fusionIsUsableOutput } from './beam.gather';
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
    boxShadow: `0px 6px 16px -8px rgb(var(--joy-palette-neutral-darkChannel) / 40%)`,
  },
  [`&.${gatherPaneClasses.busy}`]: {
    animation: `${animationShadowRingLimey} 2s linear infinite`,
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
  isMobile: boolean,
  beamStore: BeamStoreApi,
  gatherCount: number,
  scatterBusy: boolean,
}) {

  // state
  const [warnScatterBusy, setWarnScatterBusy] = React.useState(false);

  // external state
  const { setStickToBottom } = useScrollToBottom();
  const gatherShowDevMethods = useModuleBeamStore(state => state.gatherShowDevMethods);
  const {
    lastGatherLlmId, fusions, currentFusionId, isGatheringAny, isCurrentFusionGoodToGo,
    setLastGatherLlmId, setCurrentFusionId, currentFusionStart, currentFusionStop,
    stopScatteringAll,
  } = useBeamStore(props.beamStore, useShallow(state => {
    const currentFusion = state._currentFusion();
    const isCurrentFusionGoodToGo = fusionIsUsableOutput(currentFusion) && !fusionIsFusing(currentFusion);
    return {
      // state
      lastGatherLlmId: state.lastGatherLlmId,
      currentFusionId: state.currentFusionId,
      fusions: state.fusions,
      isGatheringAny: state.isGatheringAny,
      isCurrentFusionGoodToGo,

      // actions
      setLastGatherLlmId: state.setLastGatherLlmId,
      setCurrentFusionId: state.setCurrentFusionId,
      currentFusionStart: state.currentFusionStart,
      currentFusionStop: state.currentFusionStop,

      // (external slice) scatter actions
      stopScatteringAll: state.stopScatteringAll,
    };
  }));
  const [_, gatherLlmComponent, gatherLlmIcon] = useLLMSelect(
    lastGatherLlmId, setLastGatherLlmId, props.isMobile ? '' : 'Merge Model', true,
  );


  // derived state
  const { gatherCount } = props;

  const hasInputs = gatherCount >= 2;

  const gatherEnabled = hasInputs && !isGatheringAny && currentFusionId !== null;

  // const currentFusion = currentFusionId !== null ? fusions.find(fusion => fusion.fusionId === currentFusionId) ?? null : null;

  // const currentFactoryId = currentFusion ? currentFusion.factoryId : null;

  // const CurrentFusionIcon = currentFactoryId ? FUSION_FACTORIES.find(factory => factory.id === currentFactoryId)?.Icon ?? null : null;

  const handleFusionActivate = React.useCallback((fusionId: string, shiftPressed: boolean) => {
    setStickToBottom(true);
    setCurrentFusionId((fusionId !== currentFusionId || !shiftPressed) ? fusionId : null);
  }, [currentFusionId, setCurrentFusionId, setStickToBottom]);


  const handleCurrentFusionStart = React.useCallback(() => {
    // if scatter is busy, ask for confirmation
    if (props.scatterBusy) {
      setWarnScatterBusy(true);
      return;
    }
    const { inputHistory, rays } = props.beamStore.getState();
    currentFusionStart(inputHistory ? [...inputHistory] : [], rays.map(ray => ray.message));
  }, [currentFusionStart, props.beamStore, props.scatterBusy]);

  const handleStopScatterConfirmation = React.useCallback(() => {
    setWarnScatterBusy(false);
    stopScatteringAll();
    handleCurrentFusionStart();
  }, [handleCurrentFusionStart, stopScatteringAll]);

  const handleStopScatterDenial = React.useCallback(() => setWarnScatterBusy(false), []);

  // (this is great ux) scatter freed up while we were asking the question, proceed
  React.useEffect(() => {
    if (warnScatterBusy && !props.scatterBusy)
      handleStopScatterConfirmation();
  }, [handleStopScatterConfirmation, props.scatterBusy, warnScatterBusy]);


  const MainLlmIcon = gatherLlmIcon || (isGatheringAny ? AutoAwesomeIcon : AutoAwesomeOutlinedIcon);

  return <>
    <Box
      className={`${hasInputs ? gatherPaneClasses.ready : ''} ${isGatheringAny ? gatherPaneClasses.busy : ''}`}
      sx={props.isMobile ? mobileGatherPaneSx : desktopGatherPaneSx}
    >

      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 184 }}>
        <div>
          <Typography
            level='h4' component='h2'
            endDecorator={<BeamGatherDropdown />}
            // sx={{ my: 0.25 }}
          >
            <MainLlmIcon sx={{ fontSize: '1rem', animation: isGatheringAny ? `${animationColorBeamGather} 2s linear infinite` : undefined }} />&nbsp;Merge
          </Typography>
          <Typography level='body-sm' sx={{ whiteSpace: 'nowrap' }}>
            {/* may merge or not (hasInputs) N replies.. put this in pretty messages */}
            {hasInputs ? `Combine the ${gatherCount} replies` : 'Two replies or more'}
          </Typography>
        </div>
        <ScrollToBottomButton inline />
      </Box>

      {/* Method */}
      <FormControl sx={{ my: '-0.25rem' }}>
        {!props.isMobile && (
          <FormLabelStart
            title={<><AutoAwesomeMotionTwoToneIcon sx={{ fontSize: 'md', mr: 0.5 }} />Method</>}
            sx={/*{ mb: '0.25rem' }*/ undefined}
          />
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ButtonGroup variant='outlined'>
            {fusions.map(fusion => {
              // get the factory, for additional info
              const factory = FUSION_FACTORIES.find(factory => factory.id === fusion.factoryId);
              if (!factory) return null;

              // ignore dev fusions, if not asked for it
              if (factory.isDev && !gatherShowDevMethods) return null;

              // const buttonColor: ColorPaletteProp = fusion.status === 'error' ? 'danger'
              //   : fusion.status === 'fusing' ? 'warning'
              //     : fusion.status === 'success' ? GATHER_COLOR
              //       : fusion.status === 'stopped' ? GATHER_COLOR
              //         : 'neutral';

              const isActive = fusion.fusionId === currentFusionId;
              const buttonColor: ColorPaletteProp = isActive /*&& (fusion.status === 'success' || fusion.status === 'stopped')*/
                ? GATHER_COLOR
                : 'neutral';
              return (
                <Button
                  key={'fusion-' + fusion.fusionId}
                  color={buttonColor}
                  size='sm'
                  onClick={event => handleFusionActivate(fusion.fusionId, !!event?.shiftKey)}
                  startDecorator={(isActive && factory.Icon) ? <factory.Icon /> : null}
                  sx={{
                    backgroundColor: isActive ? `${buttonColor}.softBg` : 'background.popup',
                    fontWeight: isActive ? 'lg' : 400, /* reset, from 600 */
                    // minHeight: '2.25rem',
                  }}
                >
                  <GoodTooltip title={factory.description}>
                    <span>
                      {factory.label}
                    </span>
                  </GoodTooltip>
                </Button>
              );
            })}
          </ButtonGroup>
          {/*{(props.fusionIndex !== null) && (*/}
          {/*  <Tooltip disableInteractive title='Customize This Merge'>*/}
          {/*    <IconButton size='sm' color='success' disabled={props.gatherBusy || isEditable..} onClick={handleFusionCopyAsCustom}>*/}
          {/*      {isEditable... ? null : <EditRoundedIcon />}*/}
          {/*    </IconButton>*/}
          {/*  </Tooltip>*/}
          {/*)}*/}
        </Box>
      </FormControl>

      {/* LLM */}
      <Box sx={{ my: '-0.25rem', minWidth: 190, maxWidth: 220 }}>
        {gatherLlmComponent}
      </Box>

      {/* Start / Stop buttons */}
      {!isGatheringAny ? (
        <Button
          // key='gather-start' // used for animation triggering, which we don't have now
          variant={isCurrentFusionGoodToGo ? 'soft' : 'solid'} color={GATHER_COLOR}
          disabled={!gatherEnabled || isGatheringAny} loading={isGatheringAny}
          endDecorator={/*CurrentFusionIcon ? <CurrentFusionIcon /> :*/ <MergeRoundedIcon />}
          onClick={handleCurrentFusionStart}
          sx={BEAM_BTN_SX}
        >
          Merge
        </Button>
      ) : (
        <Button
          // key='gather-stop'
          variant='solid' color='danger'
          endDecorator={<StopRoundedIcon />}
          onClick={currentFusionStop}
          sx={BEAM_BTN_SX}
        >
          Stop
        </Button>
      )}

    </Box>

    {/* Confirm Stop Scattering */}
    {warnScatterBusy && (
      <ConfirmationModal
        open
        onClose={handleStopScatterDenial}
        onPositive={handleStopScatterConfirmation}
        // lowStakes
        noTitleBar
        confirmationText='Some responses are still being generated. Do you want to stop and proceed with merging the available responses now?'
        positiveActionText='Proceed with Merge'
        negativeActionText='Wait for All Responses'
        negativeActionStartDecorator={
          <CircularProgress color='neutral' sx={{ '--CircularProgress-size': '24px', '--CircularProgress-trackThickness': '1px' }} />
        }
      />
    )}

  </>;
}