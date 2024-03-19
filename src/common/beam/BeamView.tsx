import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box } from '@mui/joy';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import { ScrollToBottom } from '~/common/scroll-to-bottom/ScrollToBottom';
import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useUICounter } from '~/common/state/store-ui';

import { BeamExplainer } from './BeamExplainer';
import { BeamPaneGather } from './BeamPaneGather';
import { BeamPaneScatter } from './BeamPaneScatter';
import { BeamRayGrid } from './BeamRayGrid';
import { BeamScatterInput } from './BeamScatterInput';
import { BeamStoreApi, useBeamStore } from './store-beam.hooks';
import { SCATTER_RAY_DEF } from './beam.config';

import { createDMessage } from '~/common/state/store-chats';


const assistantMessageSx: SxProps = {
  backgroundColor: 'success.softBg',
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'md',
  borderBottom: 'none',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  px: '0.5rem',
  // boxShadow: 'sm',
  // the following make it start-aligned
  // borderTopLeftRadius: 0,
  // borderLeft: 'none',
} as const;


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
        <BeamPaneScatter
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

        {/* Gather Message */}
        <Box sx={{
          px: 'var(--Pad)',
          mb: 'calc(-1 * var(--Pad))',
        }}>
          <ChatMessageMemo
            message={createDMessage('assistant', 'Gather the messages you want to merge.')}
            fitScreen={props.isMobile}
            showAvatar={false}
            adjustContentScaling={-1}
            sx={assistantMessageSx}
          />
        </Box>

        {/*{(fusionIndex !== null) && (*/}
        {/*  <BeamFusionSettings*/}
        {/*    fusionIndex={fusionIndex}*/}
        {/*  />*/}
        {/*)}*/}

        {/* Gather Controls */}
        <BeamPaneGather
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