import * as React from 'react';
import { keyframes } from '@emotion/react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Typography } from '@mui/joy';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { useBeamState } from '~/common/chats/BeamStore';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamHeader } from './BeamHeader';
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
              boxShadow: 'sm',
            }}
          />
        </Box>
      )}

      {/* Grid */}
      <Box sx={{
        // my: 'auto',
        // display: 'flex', flexDirection: 'column', alignItems: 'center',
        border: '1px solid purple',
        minHeight: '300px',

        // layout
        display: 'grid',
        gridTemplateColumns: props.isMobile ? 'repeat(auto-fit, minmax(320px, 1fr))' : 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: { xs: 2, md: 2 },
      }}>
        {/*{candidates.map((candidate, index) => (*/}
        {/*  <BeamActor key={candidate.id} candidate={candidate} />*/}
        {/*))}*/}
      </Box>

      {/* Auto-Gatherer: All-in-one, Best-Of */}
      <Box>
        Gatherer
      </Box>


      <Box sx={{ flex: 1 }}>
        <Typography level='body-sm' sx={{ whiteSpace: 'break-spaces' }}>
          {/*{JSON.stringify(config, null, 2)}*/}
        </Typography>
      </Box>

      <Box sx={{
        height: '100%',
        borderRadius: 'lg',
        borderBottomLeftRadius: 0,
        backgroundColor: 'background.surface',
        boxShadow: 'lg',
        m: 2,
        p: '0.25rem 1rem',
      }}>

      </Box>

      <Box>
        a
      </Box>

      <Box sx={{ mt: 'auto', display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between' }}>
        <Button aria-label='Close Best-Of' variant='solid' color='neutral' onClick={handleClose} sx={{ ml: 'auto', minWidth: 100 }}>
          Close
        </Button>
      </Box>

    </Box>
  );
}