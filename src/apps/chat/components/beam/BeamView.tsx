import * as React from 'react';
import { keyframes } from '@emotion/react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Sheet } from '@mui/joy';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { useBeamStore } from '~/common/chats/store-beam';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamHeader } from './BeamHeader';
import { BeamRay } from './BeamRay';
import { ChatMessageMemo } from '../message/ChatMessage';


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


export function BeamView(props: {
  conversationHandler: ConversationHandler,
  isMobile: boolean,
  sx?: SxProps
}) {

  const { conversationHandler } = props;

  // state
  const { isOpen, inputHistory, configIssue, mergeLlmId, setMergedLlmId } = useBeamStore(conversationHandler, (state) => ({
    isOpen: state.isOpen,
    inputHistory: state.inputHistory,
    configIssue: state.configIssue,
    mergeLlmId: state.allLlmId,
    setMergedLlmId: state.setMergedLlmId,
  }));

  // external state
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(mergeLlmId, setMergedLlmId, props.isMobile ? '' : 'Beam Model');

  // derived state
  const { beamSetCount } = conversationHandler;
  const lastMessage = inputHistory?.slice(-1)[0] || null;

  console.log('mergeLlmId', mergeLlmId);
  const beamCount = 2;

  const handleCloseKeepRunning = React.useCallback(() => conversationHandler.beamClose(), [conversationHandler]);


  const handleStart = React.useCallback(() => {
    console.log('Start');
    // beamStore.destroy();
  }, []);


  // change beam count

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
        beamCount={beamCount}
        setBeamCount={beamSetCount}
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
            sx={{
              border: '1px solid',
              borderColor: 'neutral.outlinedBorder',
              borderRadius: 'lg',
              // borderBottomRightRadius: 0,
              boxShadow: 'sm',
            }}
          />
        </Box>
      )}

      {/* Rays */}
      <Box sx={{
        // style
        mx: 'var(--Pad)',

        // layout
        display: 'grid',
        gridTemplateColumns: props.isMobile ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: { xs: 2, md: 2 },
      }}>
        <BeamRay parentLlmId={mergeLlmId} isMobile={props.isMobile}>
          test
        </BeamRay>
        <BeamRay parentLlmId={mergeLlmId} isMobile={props.isMobile}>
          test2
        </BeamRay>
        <BeamRay parentLlmId={mergeLlmId} isMobile={props.isMobile}>
          test3
        </BeamRay>
        <BeamRay parentLlmId={mergeLlmId} isMobile={props.isMobile}>
          test4
        </BeamRay>
      </Box>

      {/* Bottom Bar */}
      <Sheet sx={{ mt: 'auto', p: 'var(--Pad)', display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}>
        <Button aria-label='Close Best-Of' variant='solid' color='neutral' onClick={handleCloseKeepRunning} sx={{ ml: 'auto', minWidth: 100 }}>
          Close
        </Button>
      </Sheet>

    </Box>
  );
}