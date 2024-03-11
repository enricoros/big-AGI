import * as React from 'react';
import { keyframes } from '@emotion/react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Sheet } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamHeader } from './BeamHeader';
import { BeamRay, RayCard } from './BeamRay';
import { BeamStoreApi, useBeamStore } from './store-beam';


// component configuration
const MIN_RAY_COUNT = 2;
const MAX_RAY_COUNT = 8;


const animationEnter = keyframes`
    0% {
        opacity: 0;
        //transform: translateY(8px);
        scale: 0.95;
        //rotate: -5deg;
    }
    100% {
        opacity: 1;
        //transform: translateY(0);
        scale: 1;
        //rotate: 0;
    }
`;


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


export function Beam(props: {
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

  const { close: beamClose, setRayCount: beamSetRayCount } = props.beamStore.getState();

  // state
  const { inputHistory, configIssue, gatherLlmId, setGatherLlmId, raysCount } = useBeamStore(props.beamStore,
    useShallow((state) => ({
      inputHistory: state.inputHistory,
      configIssue: state.configIssue,
      gatherLlmId: state.gatherLlmId,
      setGatherLlmId: state.setGatherLlmId,
      raysCount: state.rays.length,
    })),
  );

  // external state
  const [gatherLlm, gatherLlmComponent] = useLLMSelect(gatherLlmId, setGatherLlmId, props.isMobile ? '' : 'Beam Model');

  // derived state
  const lastMessage = inputHistory?.slice(-1)[0] || null;


  const handleCloseKeepRunning = React.useCallback(() => beamClose(), [beamClose]);

  const handleRaySetCount = React.useCallback((n: number) => {
    beamSetRayCount(n);
  }, [beamSetRayCount]);

  const handleRayIncreaseCount = React.useCallback(() => {
    beamSetRayCount(raysCount + 1);
  }, [beamSetRayCount, raysCount]);


  const handleStart = React.useCallback(() => {
    console.log('Start');
    // beamStore.destroy();
  }, []);


  // change beam count

  const bootup = !raysCount;
  React.useEffect(() => {
    bootup && handleRaySetCount(MIN_RAY_COUNT);
  }, [bootup, handleRaySetCount]);

  // const beamCount = candidates.length;
  //
  // const handleRaySetCount = React.useCallback((n: number) => {
  //   beamStore.setBeamCount(n);
  // }, [beamStore]);
  //
  // const handleIncrementBeamCount = React.useCallback(() => {
  //   beamStore.appendBeam();
  // }, [beamStore]);


  return (
    <Box sx={{
      '--Pad': { xs: '1rem', md: '1.5rem', xl: '1.5rem' },
      '--Pad_2': 'calc(var(--Pad) / 2)',
      ...props.sx,

      // animation
      animation: `${animationEnter} 0.2s cubic-bezier(.17,.84,.44,1)`,

      // layout
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--Pad)',
    }}>

      {/* Config Issues */}
      {!!configIssue && <Alert>{configIssue}</Alert>}

      {/* Header */}
      <BeamHeader
        isMobile={props.isMobile}
        llmComponent={gatherLlmComponent}
        rayCount={raysCount}
        setRayCount={handleRaySetCount}
        onStart={handleStart}
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
        <Button variant='solid' color='neutral' onClick={handleCloseKeepRunning} sx={{ ml: 'auto', minWidth: 100 }}>
          Close
        </Button>
      </Sheet>

    </Box>
  );
}