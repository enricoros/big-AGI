import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Typography } from '@mui/joy';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamGatherControls } from './BeamGatherControls';
import { BeamRay, RayCard } from './BeamRay';
import { BeamScatterControls } from './BeamScatterControls';
import { BeamStoreApi, useBeamStore } from './store-beam';


// component configuration
const MIN_RAY_COUNT = 2;
const MAX_RAY_COUNT = 8;


const userMessageSx: SxProps = {
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'md',
  borderTop: 'none',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  px: '0.5rem',
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
  sx?: SxProps,
}) {

  // external state
  const isOpen = useBeamStore(props.beamStore, state => state.isOpen);

  return isOpen ? <BeamViewBase {...props} /> : null;
}


function BeamViewBase(props: {
  beamStore: BeamStoreApi,
  isMobile: boolean,
  sx?: SxProps
}) {

  // linked state
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
  const rayIds = useBeamStore(props.beamStore, useShallow(state => state.rays.map(ray => ray.rayId)));
  const raysCount = rayIds.length;
  const { close: beamClose, setRayCount, startScatteringAll, stopScatteringAll, setGatherLlmId } = props.beamStore.getState();
  const [_gatherLlm, gatherLlmComponent] = useLLMSelect(gatherLlmId, setGatherLlmId, props.isMobile ? '' : 'Beam Model');


  // configuration

  const handleBeamDispose = React.useCallback(() => beamClose(), [beamClose]);

  const handleRaySetCount = React.useCallback((n: number) => setRayCount(n), [setRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => setRayCount(raysCount + 1), [setRayCount, raysCount]);


  // runnning

  // [effect] start with 2 rays
  const bootup = raysCount < MIN_RAY_COUNT;
  React.useEffect(() => {
    bootup && handleRaySetCount(MIN_RAY_COUNT);
  }, [bootup, handleRaySetCount]);


  const lastMessage = inputHistory?.slice(-1)[0] || null;
  const otherHistoryCount = Math.max(0, (inputHistory?.length || 0) - 1);
  const isFirstMessageSystem = inputHistory?.[0]?.role === 'system';

  const userMessageDecorator = React.useMemo(() => {
    return (otherHistoryCount >= 1) ? (
      <Typography level='body-xs' sx={{ my: 1.5, opacity: 0.8 }}>
        {otherHistoryCount === 1 ? (isFirstMessageSystem ? '1 system message' : '1 message') : `${otherHistoryCount} messages`} before
      </Typography>
    ) : null;
  }, [isFirstMessageSystem, otherHistoryCount]);


  return (
    <Box sx={{
      '--Pad': { xs: '1rem', md: '1.5rem', xl: '1.5rem' },
      '--Pad_2': 'calc(var(--Pad) / 2)',

      // enter animation
      animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

      // layout
      display: 'flex',
      flexDirection: 'column',

      ...props.sx,
    }}>

      {/* Config Issues */}
      {!!inputIssues && <Alert>{inputIssues}</Alert>}


      {/* Scrollable Layout (Scatter and Rays and Gather message) */}
      <Box sx={{
        flex: 1,
        overflowY: 'auto',

        // scrollable layout
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--Pad)',
        pb: 'var(--Pad)',
      }}>

        {/* Scatter Controls */}
        <BeamScatterControls
          isMobile={props.isMobile}
          llmComponent={gatherLlmComponent}
          rayCount={raysCount}
          setRayCount={handleRaySetCount}
          startEnabled={readyScatter}
          startBusy={isScattering}
          onStart={startScatteringAll}
          onStop={stopScatteringAll}
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
              showAvatar={false}
              adjustContentScaling={-1}
              topDecorator={userMessageDecorator}
              sx={userMessageSx}
            />
          </Box>
        )}

        {/* Rays Grid */}
        <Box sx={{
          mx: 'var(--Pad)',
          mb: 'auto',
          display: 'grid',
          gridTemplateColumns: props.isMobile ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 'var(--Pad)',
        }}>

          {rayIds.map((rayId) => (
            <BeamRay
              key={'ray-' + rayId}
              beamStore={props.beamStore}
              rayId={rayId}
              isMobile={props.isMobile}
              gatherLlmId={gatherLlmId}
            />
          ))}

          {/* Add Ray */}
          {raysCount < MAX_RAY_COUNT && (
            <RayCard sx={{ mb: 'auto' }}>
              <Button variant='plain' color='neutral' onClick={handleRayIncreaseCount} sx={{
                margin: 'calc(-1 * var(--Card-padding) + 0.25rem)',
                minHeight: 'calc(2 * var(--Card-padding) + 2rem - 0.5rem)',
              }}>
                <AddCircleOutlineRoundedIcon />
              </Button>
            </RayCard>
          )}

        </Box>

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

      </Box>

      {/* Gather Controls */}
      <BeamGatherControls
        isMobile={props.isMobile}
        gatherCount={readyGather}
        gatherEnabled={readyGather > 0 && !isScattering}
        gatherBusy={false}
        onStart={() => null}
        onStop={() => null}
        onClose={handleBeamDispose}
      />

    </Box>
  );
}