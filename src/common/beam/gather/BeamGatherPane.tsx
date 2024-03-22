import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, FormControl, SvgIconProps, Typography } from '@mui/joy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import MergeRoundedIcon from '@mui/icons-material/MergeRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';

import { BeamGatherDropdown } from '~/common/beam/gather/BeamGatherPaneDropdown';
import { BeamStoreApi, useBeamStore } from '~/common/beam/store-beam.hooks';
import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { ScrollToBottomButton } from '~/common/scroll-to-bottom/ScrollToBottomButton';
import { animationColorBeamGather, animationShadowLimey } from '~/common/util/animUtils';
import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import { FUSION_FACTORIES } from './beam.gather.factories';
import { GATHER_COLOR } from '../beam.config';
import { beamPaneSx } from '../BeamCard';


export const gatherPaneClasses = {
  active: 'gatherPane-Active',
  busy: 'gatherPane-Busy',
};

const mobileBeamGatherPane: SxProps = {
  ...beamPaneSx,
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  // [mobile] larger gap in between rows, as on mobile we have a smaller gap
  rowGap: 'var(--Pad)',
};

const desktopBeamGatherPaneSx: SxProps = {
  ...beamPaneSx,
  borderTop: '1px solid',
  borderTopColor: 'neutral.outlinedBorder',

  backgroundColor: 'background.surface',
  [`&.${gatherPaneClasses.active}`]: {
    backgroundColor: 'background.popup',
    boxShadow: `0px 6px 16px -12px rgb(var(--joy-palette-${GATHER_COLOR}-darkChannel) / 50%)`,
  },
  [`&.${gatherPaneClasses.busy}`]: {
    animation: `${animationShadowLimey} 2s linear infinite`,
  },

  // [desktop] keep visible at the bottom
  position: 'sticky',
  bottom: 0,
};


export function BeamGatherPane(props: {
  isMobile: boolean,
  beamStore: BeamStoreApi,
  gatherBusy: boolean,
  gatherCount: number,
  gatherLlmComponent: React.ReactNode,
  gatherLlmIcon?: React.FunctionComponent<SvgIconProps>,
  scatterBusy: boolean,
}) {

  // state
  const [warnScatterBusy, setWarnScatterBusy] = React.useState(false);

  // external state
  const {
    gatherShowDevMethods, gatherShowPrompts,
    toggleGatherShowDevMethods, toggleGatherShowPrompts,
    fusions, currentFusionId,
    setCurrentFusionId, currentFusionStart, currentFusionStop,
    stopScatteringAll,
  } = useBeamStore(props.beamStore, useShallow(state => {
    return {
      // state
      gatherShowDevMethods: state.gatherShowDevMethods,
      gatherShowPrompts: state.gatherShowPrompts,
      fusions: state.fusions,
      currentFusionId: state.currentFusionId,

      // actions
      toggleGatherShowDevMethods: state.toggleGatherShowDevMethods,
      toggleGatherShowPrompts: state.toggleGatherShowPrompts,
      setCurrentFusionId: state.setCurrentFusionId,
      currentFusionStart: state.currentFusionStart,
      currentFusionStop: state.currentFusionStop,

      // (external slice) scatter actions
      stopScatteringAll: state.stopScatteringAll,
    };
  }));
  const { setStickToBottom } = useScrollToBottom();


  // derived state
  const { gatherCount, gatherBusy } = props;

  const hasInputs = gatherCount >= 2;

  const gatherEnabled = hasInputs && !gatherBusy && currentFusionId !== null;

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
    currentFusionStart();
  }, [currentFusionStart, props.scatterBusy]);

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


  const dropdownMemo = React.useMemo(() => (
    <BeamGatherDropdown
      gatherShowDevMethods={gatherShowDevMethods}
      gatherShowPrompts={gatherShowPrompts}
      toggleGatherShowDevMethods={toggleGatherShowDevMethods}
      toggleGatherShowPrompts={toggleGatherShowPrompts}
    />
  ), [gatherShowDevMethods, gatherShowPrompts, toggleGatherShowDevMethods, toggleGatherShowPrompts]);


  const MainLlmIcon = props.gatherLlmIcon || (gatherBusy ? AutoAwesomeIcon : AutoAwesomeOutlinedIcon);

  return <>
    <Box
      className={`${hasInputs ? gatherPaneClasses.active : ''} ${gatherBusy ? gatherPaneClasses.busy : ''}`}
      sx={props.isMobile ? mobileBeamGatherPane : desktopBeamGatherPaneSx}
    >

      {/* Title */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 184 }}>
        <div>
          <Typography
            level='h4' component='h2'
            endDecorator={dropdownMemo}
            // sx={{ my: 0.25 }}
          >
            <MainLlmIcon sx={{ fontSize: '1rem', animation: gatherBusy ? `${animationColorBeamGather} 2s linear infinite` : undefined }} />&nbsp;Merge
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
        <FormLabelStart
          title={<><AutoAwesomeOutlinedIcon sx={{ fontSize: 'md', mr: 0.5 }} />Method</>}
          sx={/*{ mb: '0.25rem' }*/ undefined}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ButtonGroup variant='outlined'>
            {fusions.map(fusion => {
              // get the factory, for additional info
              const factory = FUSION_FACTORIES.find(factory => factory.id === fusion.factoryId);
              if (!factory) return null;

              // ignore dev fusions, if not asked for it
              if (factory.isDev && !gatherShowDevMethods) return null;

              const isActive = fusion.fusionId === currentFusionId;
              return (
                <Button
                  key={'fusion-' + fusion.fusionId}
                  color={isActive ? GATHER_COLOR : 'neutral'}
                  onClick={event => handleFusionActivate(fusion.fusionId, !!event?.shiftKey)}
                  size='sm'
                  sx={{
                    // backgroundColor: isActive ? 'background.popup' : undefined,
                    backgroundColor: isActive ? `${GATHER_COLOR}.softBg` : 'background.popup',
                    fontWeight: isActive ? 'xl' : 400, /* reset, from 600 */
                    // minHeight: '2.25rem',
                  }}
                  startDecorator={(isActive && factory.Icon) ? <factory.Icon /> : null}
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
        {props.gatherLlmComponent}
      </Box>

      {/* Start / Stop buttons */}
      {!gatherBusy ? (
        <Button
          // key='gather-start' // used for animation triggering, which we don't have now
          variant='solid' color={GATHER_COLOR}
          disabled={!gatherEnabled || gatherBusy} loading={gatherBusy}
          endDecorator={/*CurrentFusionIcon ? <CurrentFusionIcon /> :*/ <MergeRoundedIcon />}
          onClick={handleCurrentFusionStart}
          sx={{ minWidth: 120 }}
        >
          Merge
        </Button>
      ) : (
        <Button
          // key='gather-stop'
          variant='solid' color='danger'
          endDecorator={<StopRoundedIcon />}
          onClick={currentFusionStop}
          sx={{ minWidth: 120 }}
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
      />
    )}

  </>;
}