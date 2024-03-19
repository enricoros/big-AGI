import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Alert, Box } from '@mui/joy';

import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useUICounter } from '~/common/state/store-ui';

import { BeamExplainer } from './BeamExplainer';
import { BeamFusion } from './BeamFusion';
import { BeamGatherConfig } from './BeamGatherConfig';
import { BeamGatherPane } from './BeamGatherPane';
import { BeamRayGrid } from './BeamRayGrid';
import { BeamScatterInput } from './BeamScatterInput';
import { BeamScatterPane } from './BeamScatterPane';
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
    editInputHistoryMessage,
    setFusionIndex,
    setFusionLlmId,
    setRayCount,
    startGatheringCurrent,
    startScatteringAll,
    stopGatheringCurrent,
    stopScatteringAll,
  } = props.beamStore.getState();
  const {
    inputHistory, inputIssues,
    fusionIndex, fusionLlmId,
    readyScatter, isScattering,
    readyGather, isGathering,
  } = useBeamStore(props.beamStore, useShallow(state => ({
    inputHistory: state.inputHistory,
    inputIssues: state.inputIssues,
    fusionIndex: state.fusionIndex,
    fusionLlmId: state.fusionLlmId,
    readyScatter: state.readyScatter,
    isScattering: state.isScattering,
    readyGather: state.readyGather,
    isGathering: state.isGathering,
  })));
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const [_, gatherLlmComponent, gatherLlmIcon] = useLLMSelect(fusionLlmId, setFusionLlmId, props.isMobile ? '' : 'Merge Model', true);


  // derived state
  const raysCount = rayIds.length;


  // configuration

  // const handleTerminate = React.useCallback(() => terminate(), [terminate]);

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
          startEnabled={readyScatter}
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
          fusionIndex={fusionIndex}
          isMobile={props.isMobile}
        />

        {/* Gather Controls */}
        <BeamGatherPane
          gatherLlmComponent={gatherLlmComponent}
          gatherLlmIcon={gatherLlmIcon}
          gatherBusy={isGathering}
          gatherCount={readyGather}
          gatherEnabled={readyGather > 0 && !isScattering && fusionIndex !== null}
          isMobile={props.isMobile}
          fusionIndex={fusionIndex}
          setFusionIndex={setFusionIndex}
          onStartFusion={startGatheringCurrent}
          onStopFusion={stopGatheringCurrent}
        />

        {/* Fusion Output */}
        <BeamFusion
          beamStore={props.beamStore}
          fusionIndex={fusionIndex}
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