import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Alert, Box, CircularProgress } from '@mui/joy';

import { ConfirmationModal } from '~/common/components/ConfirmationModal';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useUICounter } from '~/common/state/store-ui';

import { BeamExplainer } from './BeamExplainer';
import { BeamFusionGrid } from './gather/BeamFusionGrid';
import { BeamGatherPane } from './gather/BeamGatherPane';
import { BeamRayGrid } from './scatter/BeamRayGrid';
import { BeamScatterInput } from './scatter/BeamScatterInput';
import { BeamScatterPane } from './scatter/BeamScatterPane';
import { BeamStoreApi, useBeamStore } from './store-beam.hooks';
import { useModuleBeamStore } from './store-module-beam';


export function BeamView(props: {
  beamStore: BeamStoreApi,
  isMobile: boolean,
  showExplainer?: boolean,
  // sx?: SxProps,
}) {

  // state
  const [hasAutoMerged, setHasAutoMerged] = React.useState(false);
  const [warnIsScattering, setWarnIsScattering] = React.useState(false);

  // external state
  const { novel: explainerUnseen, touch: explainerCompleted, forget: explainerShow } = useUICounter('beam-wizard');
  const gatherAutoStartAfterScatter = useModuleBeamStore(state => state.gatherAutoStartAfterScatter);
  const {
    /* root */ editInputHistoryMessage,
    /* scatter */ setRayCount, startScatteringAll, stopScatteringAll,
  } = props.beamStore.getState();
  const {
    /* root */ inputHistory, inputIssues, inputReady,
    /* scatter */ hadImportedRays, isScattering, raysReady,
    /* gather (composite) */ canGather,
  } = useBeamStore(props.beamStore, useShallow(state => ({
    // input
    inputHistory: state.inputHistory,
    inputIssues: state.inputIssues,
    inputReady: state.inputReady,
    // scatter
    hadImportedRays: state.hadImportedRays,
    isScattering: state.isScattering,
    raysReady: state.raysReady,
    // gather (composite)
    canGather: state.raysReady >= 2 && state.currentFactoryId !== null && state.currentGatherLlmId !== null,
  })));
  // the following are independent because of useShallow, which would break in the above call
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const fusionIds = useBeamStore(props.beamStore, useShallow(state => state.fusions.map(fusion => fusion.fusionId)));

  // derived state
  const raysCount = rayIds.length;


  // handlers

  const handleRaySetCount = React.useCallback((n: number) => setRayCount(n), [setRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => setRayCount(raysCount + 1), [setRayCount, raysCount]);

  const handleScatterStart = React.useCallback(() => {
    setHasAutoMerged(false);
    startScatteringAll();
  }, [startScatteringAll]);


  const handleCreateFusion = React.useCallback(() => {
    // if scatter is busy, ask for confirmation
    if (isScattering) {
      setWarnIsScattering(true);
      return;
    }
    props.beamStore.getState().createFusion();
  }, [isScattering, props.beamStore]);


  const handleStartMergeConfirmation = React.useCallback(() => {
    setWarnIsScattering(false);
    stopScatteringAll();
    handleCreateFusion();
  }, [handleCreateFusion, stopScatteringAll]);

  const handleStartMergeDenial = React.useCallback(() => setWarnIsScattering(false), []);


  // auto-merge
  const shallAutoMerge = gatherAutoStartAfterScatter && canGather && !isScattering && !hasAutoMerged;
  React.useEffect(() => {
    if (shallAutoMerge) {
      setHasAutoMerged(true);
      handleStartMergeConfirmation();
    }
  }, [handleStartMergeConfirmation, shallAutoMerge]);

  // (great ux) scatter finished while the "start merge" (warning) dialog is up: dismiss dialog and proceed
  // here we assume that 'warnIsScattering' shows the intention of the user to proceed with a merge asap
  const shallResumeMerge = warnIsScattering && !isScattering && !gatherAutoStartAfterScatter;
  React.useEffect(() => {
    if (shallResumeMerge)
      handleStartMergeConfirmation();
  }, [handleStartMergeConfirmation, shallResumeMerge]);


  // runnning

  // [effect] pre-populate a default number of rays
  // const bootup = raysCount < SCATTER_RAY_DEF;
  // React.useEffect(() => {
  //   bootup && handleRaySetCount(SCATTER_RAY_DEF);
  // }, [bootup, handleRaySetCount]);


  // Explainer, if unseen
  if (props.showExplainer && explainerUnseen)
    return <BeamExplainer onWizardComplete={explainerCompleted} />;

  return <>

    <Box sx={{
      // scroller fill
      minHeight: '100%',
      // ...props.sx,

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
        onStart={handleScatterStart}
        onStop={stopScatteringAll}
        onExplainerShow={explainerShow}
      />


      {/* Rays Grid */}
      <BeamRayGrid
        beamStore={props.beamStore}
        isMobile={props.isMobile}
        rayIds={rayIds}
        hadImportedRays={hadImportedRays}
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
        // onAddFusion={handleCreateFusion}
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
        onClose={handleStartMergeDenial}
        onPositive={handleStartMergeConfirmation}
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