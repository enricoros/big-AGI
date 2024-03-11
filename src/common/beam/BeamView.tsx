import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Sheet } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import { animationEnterScaleUp } from '~/common/util/animUtils';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamHeader } from './BeamHeader';
import { BeamRay, RayCard } from './BeamRay';
import { BeamStoreApi, useBeamStore } from './store-beam';


// component configuration
const MIN_RAY_COUNT = 2;
const MAX_RAY_COUNT = 8;


const userMessageSx: SxProps = {
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'md',
  borderTopLeftRadius: 0,
  borderTopRightRadius: 0,
  borderTop: 'none',
  px: '0.5rem',
  // boxShadow: 'sm',
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
    gatherLlmId,
    readyScatter, isScattering,
    readyGather, isGathering,
    raysCount,
  } = useBeamStore(props.beamStore, useShallow((state) => ({
    // state
    inputHistory: state.inputHistory,
    inputIssues: state.inputIssues,
    gatherLlmId: state.gatherLlmId,
    readyScatter: state.readyScatter,
    isScattering: state.isScattering,
    readyGather: state.readyGather,
    isGathering: state.isGathering,
    raysCount: state.rays.length,
  })));
  const { close: beamClose, setRayCount, startScatteringAll, stopScatteringAll, setGatherLlmId } = props.beamStore.getState();
  const [gatherLlm, gatherLlmComponent] = useLLMSelect(gatherLlmId, setGatherLlmId, props.isMobile ? '' : 'Beam Model');


  // configuration

  const handleDispose = React.useCallback(() => beamClose(), [beamClose]);

  const handleRaySetCount = React.useCallback((n: number) => setRayCount(n), [setRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => setRayCount(raysCount + 1), [setRayCount, raysCount]);


  // runnning

  // [effect] start with 2 rays
  const bootup = !raysCount;
  React.useEffect(() => {
    bootup && handleRaySetCount(MIN_RAY_COUNT);
  }, [bootup, handleRaySetCount]);


  const lastMessage = inputHistory?.slice(-1)[0] || null;


  return (
    <Box sx={{
      '--Pad': { xs: '1rem', md: '1.5rem', xl: '1.5rem' },
      '--Pad_2': 'calc(var(--Pad) / 2)',
      ...props.sx,

      // animation
      animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

      // layout
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--Pad)',
    }}>

      {/* Config Issues */}
      {!!inputIssues && <Alert>{inputIssues}</Alert>}

      {/* Header */}
      <BeamHeader
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
            sx={userMessageSx}
          />
        </Box>
      )}

      {/* Rays */}
      {!!raysCount && (
        <Box sx={{
          mx: 'var(--Pad)',
          display: 'grid',
          gridTemplateColumns: props.isMobile ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 'var(--Pad)',
        }}>

          {Array.from({ length: raysCount }, (_, idx) => (
            <BeamRay
              key={'ray-' + idx}
              beamStore={props.beamStore}
              index={idx}
              isMobile={props.isMobile}
              gatherLlmId={gatherLlmId}
            />
          ))}

          {/* Increment Rays Button */}
          {raysCount < MAX_RAY_COUNT && (
            <RayCard>
              <Button variant='plain' color='neutral' onClick={handleRayIncreaseCount} sx={{
                height: '100%',
                margin: 'calc(-1 * var(--Card-padding) + 0.25rem)',
                minHeight: 'calc(2 * var(--Card-padding) + 2rem - 0.5rem)',
                // minHeight: '2rem',
              }}>
                <AddIcon />
              </Button>
            </RayCard>
          )}

        </Box>
      )}

      {/* Bottom Bar */}
      <Sheet sx={{ mt: 'auto', p: 'var(--Pad)', display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Button variant='solid' color='neutral' onClick={handleDispose} sx={{ ml: 'auto', minWidth: 100 }}>
          Close
        </Button>
      </Sheet>

    </Box>
  );
}