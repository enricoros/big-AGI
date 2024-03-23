import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Alert, Box } from '@mui/joy';

import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useUICounter } from '~/common/state/store-ui';

import { BeamExplainer } from './BeamExplainer';
import { BeamGatherInput } from './gather/BeamGatherInput';
import { BeamGatherOutput } from './gather/BeamGatherOutput';
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
    /* gather */ setGatherLlmId,
  } = props.beamStore.getState();
  const {
    /* root */ inputHistory, inputIssues, inputReady,
    /* scatter */ isScattering, raysReady,
    /* gather */ gatherLlmId,
  } = useBeamStore(props.beamStore, useShallow(state => ({
    inputHistory: state.inputHistory, inputIssues: state.inputIssues, inputReady: state.inputReady,
    isScattering: state.isScattering, raysReady: state.raysReady,
    gatherLlmId: state.gatherLlmId,
  })));
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const [_, gatherLlmComponent, gatherLlmIcon] = useLLMSelect(gatherLlmId, setGatherLlmId, props.isMobile ? '' : 'Merge Model', true);


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

  return (
    <ScrollToBottom>

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
          linkedLlmId={gatherLlmId}
          isMobile={props.isMobile}
          rayIds={rayIds}
          onIncreaseRayCount={handleRayIncreaseCount}
        />

        {/* Gapper between Rays and Merge, without compromising the auto margin of the Ray Grid */}
        <Box />

        {/* Fusion Config */}
        <BeamGatherInput
          beamStore={props.beamStore}
        />

        {/* Gather Controls */}
        <BeamGatherPane
          isMobile={props.isMobile}
          beamStore={props.beamStore}
          gatherCount={raysReady}
          gatherLlmComponent={gatherLlmComponent}
          gatherLlmIcon={gatherLlmIcon}
          scatterBusy={isScattering}
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