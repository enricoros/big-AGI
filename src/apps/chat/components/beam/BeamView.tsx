import * as React from 'react';
import { keyframes } from '@emotion/react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Sheet } from '@mui/joy';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { useBeamStore } from '~/common/chats/store-beam';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamHeader } from './BeamHeader';
import { BeamRay } from './BeamRay';
import { ChatMessageMemo } from '../message/ChatMessage';


// component configuration
const MIN_BEAM_COUNT = 2;
const MAX_BEAM_COUNT = 8;


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

  const { conversationHandler } = props;

  // state
  const { isOpen, inputHistory, configIssue, mergeLlmId, setMergedLlmId, beamsCount } = useBeamStore(conversationHandler,
    useShallow((state) => ({
      isOpen: state.isOpen,
      inputHistory: state.inputHistory,
      configIssue: state.configIssue,
      mergeLlmId: state.gatherLlmId,
      setMergedLlmId: state.setMergedLlmId,
      beamsCount: state.rays.length,
    })),
  );

  // external state
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(mergeLlmId, setMergedLlmId, props.isMobile ? '' : 'Beam Model');

  // derived state
  const { beamSetRayCount } = conversationHandler;
  const lastMessage = inputHistory?.slice(-1)[0] || null;

  console.log('mergeLlmId', mergeLlmId);

  const handleCloseKeepRunning = React.useCallback(() => conversationHandler.beamClose(), [conversationHandler]);

  const handleSetBeamCount = React.useCallback((n: number) => conversationHandler.beamSetRayCount(n), [conversationHandler]);


  const handleStart = React.useCallback(() => {
    console.log('Start');
    // beamStore.destroy();
  }, []);


  // change beam count

  React.useEffect(() => {
    !beamsCount && handleSetBeamCount(MIN_BEAM_COUNT);
  }, [beamsCount, handleSetBeamCount]);

  // const beamCount = candidates.length;
  //
  // const handleSetBeamCount = React.useCallback((n: number) => {
  //   beamStore.setBeamCount(n);
  // }, [beamStore]);
  //
  // const handleIncrementBeamCount = React.useCallback(() => {
  //   beamStore.appendBeam();
  // }, [beamStore]);


  if (!isOpen)
    return null;


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
        beamCount={beamsCount}
        setBeamCount={handleSetBeamCount}
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
          <ChatMessageMemo message={lastMessage} fitScreen={props.isMobile} sx={chatMessageSx} />
        </Box>
      )}

      {/* Rays */}
      {!!beamsCount && (
        <Box sx={{
          // style
          mx: 'var(--Pad)',

          // layout
          display: 'grid',
          gridTemplateColumns: props.isMobile ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: { xs: 2, md: 2 },
        }}>
          {Array.from({ length: beamsCount }, (_, idx) => (
            <BeamRay key={idx} index={idx} parentLlmId={mergeLlmId} isMobile={props.isMobile} />
          ))}
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