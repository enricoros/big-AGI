import * as React from 'react';
import { keyframes } from '@emotion/react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Sheet } from '@mui/joy';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { useBeamState } from '~/common/chats/BeamStore';
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

  // state
  const { beamStore } = props.conversationHandler;
  const { config, candidates } = useBeamState(beamStore);

  // external state
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(true, props.isMobile ? '' : 'Beam Model');

  // derived state
  const lastMessage = config?.history.slice(-1)[0] || null;


  const handleClose = React.useCallback(() => {
    beamStore.destroy();
  }, [beamStore]);

  const handleStart = React.useCallback(() => {
    console.log('Start');
    // beamStore.destroy();
  }, []);


  // change beam count

  const beamCount = candidates.length;

  const handleSetBeamCount = React.useCallback((n: number) => {
    beamStore.setBeamCount(n);
  }, [beamStore]);

  const handleIncrementBeamCount = React.useCallback(() => {
    beamStore.appendBeam();
  }, [beamStore]);


  if (!config || !lastMessage)
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
      {!!config?.configError && <Alert>{config.configError}</Alert>}

      {/* Header */}
      <BeamHeader
        isMobile={props.isMobile}
        beamCount={beamCount}
        setBeamCount={beamStore.setBeamCount}
        llmSelectComponent={allChatLlmComponent}
        onStart={handleClose}
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
        <BeamRay key='a' isMobile={props.isMobile}>
          test
        </BeamRay>
        <BeamRay key='b' isMobile={props.isMobile}>
          test2
        </BeamRay>
        <BeamRay isMobile={props.isMobile}>
          test3
        </BeamRay>
        <BeamRay isMobile={props.isMobile}>
          test4
        </BeamRay>
      </Box>

      {/* Bottom Bar */}
      <Sheet sx={{ mt: 'auto', p: 'var(--Pad)', display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}>
        <Button aria-label='Close Best-Of' variant='solid' color='neutral' onClick={handleClose} sx={{ ml: 'auto', minWidth: 100 }}>
          Close
        </Button>
      </Sheet>

    </Box>
  );
}