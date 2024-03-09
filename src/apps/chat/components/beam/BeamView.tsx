import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Typography } from '@mui/joy';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { useBeamState } from '~/common/chats/BeamStore';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';

import { BeamViewSheet } from './BeamViewSheet';
import { BeamHeader } from './BeamHeader';


export function BeamView(props: {
  conversationHandler: ConversationHandler,
  isMobile: boolean,
  sx?: SxProps
}) {

  const { conversationHandler, isMobile } = props;
  const { beamStore } = conversationHandler;

  // state
  const { config, candidates } = useBeamState(beamStore);

  // external state
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(true, isMobile ? '' : 'Beam Model');

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


  const lastMessage = config ? config.history.slice(-1)[0] ?? null : null;


  if (!config)
    return null;


  return (
    <BeamViewSheet sx={{
      '--Pad': { xs: '1rem', md: '1.5rem', xl: '1.5rem' },
      '--Pad_2': 'calc(var(--Pad) / 2)',
      ...props.sx,

      // layout
      display: 'flex',
      gap: 'var(--Pad)',
    }}>

      {/* Issues */}
      {!!config.configError && (
        <Alert>
          {config.configError}
        </Alert>
      )}

      {/* Header */}
      <BeamHeader
        isMobile={isMobile}
        beamCount={beamCount}
        setBeamCount={beamStore.setBeamCount}
        llmSelectComponent={allChatLlmComponent}
        onStart={handleClose}
      />

      {/* Models,  [x] all same, */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'start', gap: 2 }}>

        {!!lastMessage && (
          <Box sx={{
            backgroundColor: 'background.surface',
            boxShadow: 'xs',
            borderRadius: 'lg',
            borderTopRightRadius: 0,
            borderTopLeftRadius: 0,
            py: 1,
            px: 1,
            mb: 'auto',

            flex: 1,
          }}>
            {lastMessage.text}
          </Box>
          // <ChatMessageMemo
          //   message={lastMessage}
          //   fitScreen={props.isMobile}
          //   sx={{
          //     borderRadius: 'lg',
          //     borderBottomRightRadius: lastMessage.role === 'assistant' ? undefined : 0,
          //     borderBottomLeftRadius: lastMessage.role === 'user' ? undefined : 0,
          //     boxShadow: 'xs',
          //     my: 2,
          //     px: 0,
          //     py: 1,
          //     alignSelf: 'self-end',
          //     flex: 1,
          //     maxHeight: '5rem',
          //     overflow: 'hidden',
          //   }}
          // />
        )}
      </Box>

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

    </BeamViewSheet>
  );
}