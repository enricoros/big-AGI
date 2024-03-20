import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Alert, Box } from '@mui/joy';

import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useUICounter } from '~/common/state/store-ui';

import { BeamExplainer } from './BeamExplainer';
import { BeamGatherOutput } from './gather/BeamGatherOutput';
import { BeamGatherConfig } from './gather/BeamGatherConfig';
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

  // linked state
  const { novel: explainerUnseen, touch: explainerCompleted, forget: explainerShow } = useUICounter('beam-wizard');
  const {
    /* root */ editInputHistoryMessage,
    /* scatter */ setRayCount, startScatteringAll, stopScatteringAll,
    /* gather */ setFusionIndex, setFusionLlmId, fusionCustomize, fusionStart, fusionStop,
  } = props.beamStore.getState();
  const {
    /* root */ inputHistory, inputIssues, inputReady,
    /* scatter */ isScattering, raysReady,
    /* gather */ fusionIndex, fusionLlmId, isGathering,
  } = useBeamStore(props.beamStore, useShallow(state => ({
    inputHistory: state.inputHistory, inputIssues: state.inputIssues, inputReady: state.inputReady,
    isScattering: state.isScattering, raysReady: state.raysReady,
    fusionIndex: state.fusionIndex, fusionLlmId: state.fusionLlmId, isGathering: state.isGathering,
  })));
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const [_, gatherLlmComponent, gatherLlmIcon] = useLLMSelect(fusionLlmId, setFusionLlmId, props.isMobile ? '' : 'Merge Model', true);


  // derived state
  const raysCount = rayIds.length;


  // handlers

  const handleRaySetCount = React.useCallback((n: number) => setRayCount(n), [setRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => setRayCount(raysCount + 1), [setRayCount, raysCount]);


  // runnning

  // [effect] pre-populate a default number of rays
  const bootup = raysCount < SCATTER_RAY_DEF;
  React.useEffect(() => {
    bootup && handleRaySetCount(SCATTER_RAY_DEF);
  }, [bootup, handleRaySetCount]);


  // Explainer, if unseen
  if (props.showExplainer && explainerUnseen)
    return <BeamExplainer onWizardComplete={explainerCompleted} />;

  console.log('BeamView', props.beamStore.getState());
  return (
    <ScrollToBottom disableAutoStick>

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
        pb: 'var(--Pad)',
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
          linkedLlmId={fusionLlmId}
          isMobile={props.isMobile}
          rayIds={rayIds}
          onIncreaseRayCount={handleRayIncreaseCount}
        />


        {/* Fusion Config */}
        <BeamGatherConfig
          beamStore={props.beamStore}
          isMobile={props.isMobile}
        />

        {/* Gather Controls */}
        <BeamGatherPane
          gatherLlmComponent={gatherLlmComponent}
          gatherLlmIcon={gatherLlmIcon}
          gatherBusy={isGathering}
          gatherCount={raysReady}
          gatherEnabled={raysReady > 0 && !isGathering && fusionIndex !== null}
          isMobile={props.isMobile}
          fusionIndex={fusionIndex}
          setFusionIndex={setFusionIndex}
          onFusionCustomize={fusionCustomize}
          onFusionStart={fusionStart}
          onFusionStop={fusionStop}
        />

        {/* Fusion Output */}
        <BeamGatherOutput
          beamStore={props.beamStore}
          isMobile={props.isMobile}
        />

      </Box>

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