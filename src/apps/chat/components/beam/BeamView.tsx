import * as React from 'react';
import { keyframes } from '@emotion/react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Sheet } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { useBeamStore } from '~/common/chats/store-beam';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamHeader } from './BeamHeader';
import { BeamRay, RayCard } from './BeamRay';
import { ChatMessageMemo } from '../message/ChatMessage';


// component configuration
const MIN_RAY_COUNT = 2;
const MAX_RAY_COUNT = 8;


const animationEnter = keyframes`
    0% {
        //opacity: 0;
        //transform: translateY(8px);
        scale: 1.1;
        //rotate: -5deg;
    }
    100% {
        opacity: 1;
        transform: translateY(0);
        scale: 1;
        rotate: 0;
    }
`;


const chatMessageSx: SxProps = {
  border: '1px solid',
  borderColor: 'neutral.outlinedBorder',
  borderRadius: 'lg',
  // borderBottomRightRadius: 0,
  boxShadow: 'sm',
} as const;


export function BeamView(props: {
  conversationHandler: ConversationHandler,
  isMobile: boolean,
  sx?: SxProps
}) {

  // external state
  const isOpen = useBeamStore(props.conversationHandler, state => state.isOpen);

  return isOpen ? <BeamViewBase {...props} /> : null;
}

function BeamViewBase(props: {
  conversationHandler: ConversationHandler,
  isMobile: boolean,
  sx?: SxProps
}) {

  const { conversationHandler } = props;

  // state
  const { inputHistory, configIssue, gatherLlmId, setMergedLlmId, raysCount } = useBeamStore(conversationHandler,
    useShallow((state) => ({
      inputHistory: state.inputHistory,
      configIssue: state.configIssue,
      gatherLlmId: state.gatherLlmId,
      setMergedLlmId: state.setMergedLlmId,
      raysCount: state.rays.length,
    })),
  );

  // external state
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(gatherLlmId, setMergedLlmId, props.isMobile ? '' : 'Beam Model');

  // derived state
  const lastMessage = inputHistory?.slice(-1)[0] || null;


  const handleCloseKeepRunning = React.useCallback(() => {
    conversationHandler.beamClose();
  }, [conversationHandler]);

  const handleRaySetCount = React.useCallback((n: number) => {
    conversationHandler.beamSetRayCount(n);
  }, [conversationHandler]);

  const handleRayIncreaseCount = React.useCallback(() => {
    conversationHandler.beamIncreaseRayCount();
  }, [conversationHandler]);


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

      {/* Issues */}
      {!!configIssue && <Alert>{configIssue}</Alert>}

      {/* Header */}
      <BeamHeader
        isMobile={props.isMobile}
        rayCount={raysCount}
        setRayCount={handleRaySetCount}
        llmSelectComponent={allChatLlmComponent}
        onStart={handleCloseKeepRunning}
      />

      {/* Last message */}
      {!!lastMessage && (
        <Box sx={{
          px: 'var(--Pad)',
          display: 'grid',
          gap: 'var(--Pad_2)',
        }}>
          <ChatMessageMemo
            message={lastMessage}
            fitScreen={props.isMobile}
            adjustContentScaling={-1}
            sx={chatMessageSx}
          />
        </Box>
      )}

      {/* Rays */}
      {!!raysCount && (
        <Box sx={{
          // style
          mx: 'var(--Pad)',

          // layout
          display: 'grid',
          gridTemplateColumns: props.isMobile ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: { xs: 2, md: 2 },
        }}>
          {Array.from({ length: raysCount }, (_, idx) => (
            <BeamRay
              key={'ray-' + idx}
              conversationHandler={conversationHandler}
              index={idx}
              isMobile={props.isMobile}
              gatherLlmId={gatherLlmId}
            />
          ))}
          {raysCount < MAX_RAY_COUNT && (
            <RayCard>
              <Button variant='plain' color='neutral' onClick={handleRayIncreaseCount} sx={{
                width: '100%',
                height: '100%',
                minHeight: 'calc(3 * var(--Pad))',
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