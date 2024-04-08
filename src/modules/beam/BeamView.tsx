import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Alert, Box, CircularProgress } from '@mui/joy';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useUICounter } from '~/common/state/store-ui';

import { BeamExplainer } from './BeamExplainer';
import { BeamFusionGrid } from './gather/BeamFusionGrid';
import { BeamGatherPane } from './gather/BeamGatherPane';
import { BeamRayGrid } from './scatter/BeamRayGrid';
import { BeamScatterInput } from './scatter/BeamScatterInput';
import { BeamScatterPane } from './scatter/BeamScatterPane';
import { BeamStoreApi, useBeamStore } from './store-beam.hooks';
import { SCATTER_RAY_DEF } from './beam.config';


export function BeamView(props: {
  beamStore: BeamStoreApi,
  isMobile: boolean,
  showExplainer?: boolean,
}) {

  // state
  const [warnIsScattering, setWarnIsScattering] = React.useState(false);

  // external state
  const { novel: explainerUnseen, touch: explainerCompleted, forget: explainerShow } = useUICounter('beam-wizard');
  const {
    /* root */ editInputHistoryMessage,
    /* scatter */ setRayCount, startScatteringAll, stopScatteringAll,
  } = props.beamStore.getState();
  const {
    /* root */ inputHistory, inputIssues, inputReady,
    /* scatter */ isScattering, raysReady,
    /* gather (composite) */ canGather,
  } = useBeamStore(props.beamStore, useShallow(state => ({
    inputHistory: state.inputHistory,
    inputIssues: state.inputIssues,
    inputReady: state.inputReady,
    // scatter
    isScattering: state.isScattering,
    raysReady: state.raysReady,
    // gather (composite)
    canGather: state.raysReady >= 2 && state.currentFactoryId !== null && state.currentGatherLlmId !== null,
  })));
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const fusionIds = useBeamStore(props.beamStore, useShallow(state => state.fusions.map(fusion => fusion.fusionId)));

  // derived state
  const raysCount = rayIds.length;


  // handlers

  const handleRaySetCount = React.useCallback((n: number) => setRayCount(n), [setRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => setRayCount(raysCount + 1), [setRayCount, raysCount]);


  const handleCreateFusion = React.useCallback(() => {
    // if scatter is busy, ask for confirmation
    if (isScattering) {
      setWarnIsScattering(true);
      return;
    }
    props.beamStore.getState().createFusion();
  }, [isScattering, props.beamStore]);


  const handleStopScatterConfirmation = React.useCallback(() => {
    setWarnIsScattering(false);
    stopScatteringAll();
    handleCreateFusion();
  }, [handleCreateFusion, stopScatteringAll]);

  const handleStopScatterDenial = React.useCallback(() => setWarnIsScattering(false), []);


  // (this is great ux) scatter freed up while we were asking the question, proceed
  React.useEffect(() => {
    if (warnIsScattering && !isScattering)
      handleStopScatterConfirmation();
  }, [handleStopScatterConfirmation, isScattering, warnIsScattering]);


  // runnning

  // [effect] pre-populate a default number of rays
  const bootup = raysCount < SCATTER_RAY_DEF;
  React.useEffect(() => {
    bootup && handleRaySetCount(SCATTER_RAY_DEF);
  }, [bootup, handleRaySetCount]);


  // Explainer, if unseen
  if (props.showExplainer && explainerUnseen)
    return <BeamExplainer onWizardComplete={explainerCompleted} />;

  return (
    <ScrollToBottom disableAutoStick>

      {/* Main V-Layout */}
      <Box sx={{
        // scroller fill
        minHeight: '100%',

        // enter animation
        animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

        // config
        '--Pad': { xs: '1rem', md: '1.5rem' },
        '--Pad_2': 'calc(var(--Pad) / 2)',

        // layout
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--Pad)',
      }}>

        {/* Config Issues */}
        {!!inputIssues && <Alert>{inputIssues}</Alert>}


        {/* User Message */}
        <BeamScatterInput
          isMobile={props.isMobile}
          history={inputHistory}
          editHistory={editInputHistoryMessage}
        />

        {/* Scatter Controls */}
        <BeamScatterPane
          beamStore={props.beamStore}
          isMobile={props.isMobile}
          rayCount={raysCount}
          setRayCount={handleRaySetCount}
          startEnabled={inputReady}
          startBusy={isScattering}
          onStart={startScatteringAll}
          onStop={stopScatteringAll}
          onExplainerShow={explainerShow}
        />


        {/* Rays Grid */}
        <BeamRayGrid
          beamStore={props.beamStore}
          isMobile={props.isMobile}
          rayIds={rayIds}
          onIncreaseRayCount={handleRayIncreaseCount}
          // linkedLlmId={currentGatherLlmId}
        />


        {/* Gapper between Rays and Merge, without compromising the auto margin of the Ray Grid */}
        <Box />


        {/* Gather Controls */}
        <BeamGatherPane
          beamStore={props.beamStore}
          canGather={canGather}
          isMobile={props.isMobile}
          onAddFusion={handleCreateFusion}
          raysReady={raysReady}
        />

        {/* Fusion Grid */}
        <BeamFusionGrid
          beamStore={props.beamStore}
          canGather={canGather}
          fusionIds={fusionIds}
          isMobile={props.isMobile}
          onAddFusion={handleCreateFusion}
          raysCount={raysCount}
        />

      </Box>


      {/* Confirm Stop Scattering */}
      {warnIsScattering && (
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


    </ScrollToBottom>
  );
}


/* Commented code with a callout box to explain the first message
  <Box>
    <CalloutTopRightIcon sx={{ color: 'primary.solidBg', fontSize: '2.53rem', rotate: '-10deg' }} />
    <Chip
      color='primary'
      variant='solid'
      endDecorator={<ChipDelete onClick={() => alert('aa')} />}
      sx={{
        mx: -2,
        py: 1,
        px: 2,
      }}
    >
      Last message in the conversation
    </Chip>
  </Box>
*/