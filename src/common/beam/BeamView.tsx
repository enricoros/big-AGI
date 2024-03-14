import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Typography } from '@mui/joy';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { useUICounter } from '~/common/state/store-ui';

import { BeamPaneGather } from './BeamPaneGather';
import { BeamPaneScatter } from './BeamPaneScatter';
import { BeamRayGrid, DEF_RAY_COUNT } from './BeamRayGrid';
import { BeamStoreApi, useBeamStore } from './store-beam.hooks';
import { BeamExplainer } from './BeamExplainer';


const userMessageSx: SxProps = {
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'md',
  borderTop: 'none',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  // px: '0.5rem',
  pr: '0.125rem',
  // boxShadow: 'sm',
  // the following make it end-aligned
  // borderBottomRightRadius: 0,
  // borderRight: 'none',
  // px: 'var(--Pad)',
} as const;

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
  sx?: SxProps,
}) {

  // state
  const [showHistoryMessage, setShowHistoryMessage] = React.useState(true);

  // linked state
  const { novel: explainerUnseen, touch: explainerCompleted, forget: explainerShow } = useUICounter('beam-wizard');
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const raysCount = rayIds.length;
  const {
    inputHistory, inputIssues,
    gatherLlmId, gatherMessage,
    readyScatter, isScattering,
    readyGather, isGathering,
  } = useBeamStore(props.beamStore, useShallow((state) => ({
    // state
    inputHistory: state.inputHistory,
    inputIssues: state.inputIssues,
    gatherLlmId: state.gatherLlmId,
    gatherMessage: state.gatherMessage,
    readyScatter: state.readyScatter,
    isScattering: state.isScattering,
    readyGather: state.readyGather,
    isGathering: state.isGathering,
  })));
  const { editHistoryMessage, setRayCount, startScatteringAll, stopScatteringAll, setGatherLlmId, terminate } = props.beamStore.getState();
  const [_gatherLlm, gatherLlmComponent] = useLLMSelect(gatherLlmId, setGatherLlmId, props.isMobile ? '' : 'Beam and Merge Model');


  // configuration

  const handleTerminate = React.useCallback(() => terminate(), [terminate]);

  const handleRaySetCount = React.useCallback((n: number) => setRayCount(n), [setRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => setRayCount(raysCount + 1), [setRayCount, raysCount]);


  // runnning

  // [effect] pre-populate a default number of rays
  const bootup = raysCount < DEF_RAY_COUNT;
  React.useEffect(() => {
    bootup && handleRaySetCount(DEF_RAY_COUNT);
  }, [bootup, handleRaySetCount]);


  const lastMessage = inputHistory?.slice(-1)[0] || null;

  const otherHistoryCount = Math.max(0, (inputHistory?.length || 0) - 1);
  const isFirstMessageSystem = inputHistory?.[0]?.role === 'system';
  const userMessageDecorator = React.useMemo(() => {
    return (otherHistoryCount >= 1 && showHistoryMessage) ? (
      <Typography level='body-xs' sx={{ my: 1.5, opacity: 0.9 }} onClick={() => setShowHistoryMessage(on => !on)}>
        ... {otherHistoryCount === 1 ? (isFirstMessageSystem ? '1 system message' : '1 message') : `${otherHistoryCount} messages`} before ...
      </Typography>
    ) : null;
  }, [isFirstMessageSystem, otherHistoryCount, showHistoryMessage]);

  if (props.showExplainer && explainerUnseen)
    return <BeamExplainer onWizardComplete={explainerCompleted} sx={props.sx} />;

  return (
    <Box sx={{
      '--Pad': { xs: '1rem', md: '1.5rem' },
      '--Pad_2': 'calc(var(--Pad) / 2)',

      // enter animation
      animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

      // scrollable layout
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--Pad)',
      pb: 'var(--Pad)',

      ...props.sx,
    }}>

      {/* Config Issues */}
      {!!inputIssues && <Alert>{inputIssues}</Alert>}

      {/* Scatter Controls */}
      <BeamPaneScatter
        isMobile={props.isMobile}
        llmComponent={gatherLlmComponent}
        rayCount={raysCount}
        setRayCount={handleRaySetCount}
        startEnabled={readyScatter}
        startBusy={isScattering}
        onStart={startScatteringAll}
        onStop={stopScatteringAll}
        onExplainerShow={explainerShow}
      />

      {/* User Message */}
      {!!lastMessage && (
        <Box sx={{
          px: 'var(--Pad)',
          mt: 'calc(-1 * var(--Pad))',
        }}>
          <ChatMessageMemo
            message={lastMessage}
            fitScreen={props.isMobile}
            showAvatar={true}
            adjustContentScaling={-1}
            topDecorator={userMessageDecorator}
            onMessageEdit={editHistoryMessage}
            sx={userMessageSx}
          />
        </Box>
      )}

      {/* Rays Grid */}
      <BeamRayGrid
        beamStore={props.beamStore}
        gatherLlmId={gatherLlmId}
        isMobile={props.isMobile}
        rayIds={rayIds}
        onIncreaseRayCount={handleRayIncreaseCount}
      />

      {/* Gather Message */}
      {(!!gatherMessage && !!gatherMessage.updated) && (
        <Box sx={{
          px: 'var(--Pad)',
          mb: 'calc(-1 * var(--Pad))',
        }}>
          <ChatMessageMemo
            message={gatherMessage}
            fitScreen={props.isMobile}
            showAvatar={false}
            adjustContentScaling={-1}
            sx={assistantMessageSx}
          />
        </Box>
      )}

      {/* Gather Controls */}
      <BeamPaneGather
        isMobile={props.isMobile}
        gatherCount={readyGather}
        gatherEnabled={readyGather > 0 && !isScattering}
        gatherBusy={false}
        onStart={() => null}
        onStop={() => null}
        onClose={handleTerminate}
      />

    </Box>
  );
}