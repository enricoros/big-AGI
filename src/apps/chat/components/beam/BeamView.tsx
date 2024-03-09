import * as React from 'react';
import { useState } from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Sheet, Typography } from '@mui/joy';

import type { ConversationHandler } from '~/common/chats/ConversationHandler';
import { useBeamState } from '~/common/chats/BeamStore';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';
import { BeamViewSheet } from './BeamViewSheet';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { Brand } from '~/common/app.config';
import { cssRainbowColorKeyframes } from '~/common/app.theme';


export function BeamView(props: {
  conversationHandler: ConversationHandler,
  isMobile: boolean,
  sx?: SxProps
}) {

  const { conversationHandler, isMobile } = props;

  // state
  const { config, candidates } = useBeamState(conversationHandler.beamStore);
  const [tempRepeat, setTempRepeat] = useState<number>(2);

  // external state
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(true, isMobile ? '' : 'Beam LLM');

  const handleClose = React.useCallback(() => {
    conversationHandler.beamStore.destroy();
  }, [conversationHandler.beamStore]);

  if (!config)
    return null;

  const lastMessage = config.history.slice(-1)[0] ?? null;

  return (
    <BeamViewSheet sx={{
      '--Pad': { xs: '1rem', md: '1.5rem', xl: '1.5rem' },
      '--Pad_2': 'calc(var(--Pad) * 2)',
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


      <Sheet sx={{
        // style
        boxShadow: 'md',
        p: 'var(--Pad)',

        // layout: max 2 cols (/3 with gap) of min 200px per col
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(max(200px, 100%/4), 1fr))',
        gridAutoFlow: 'row dense',
        gap: 'var(--Pad)',

        // '& > *': { border: '2px solid red' },
      }}>

        {/* Title */}
        <Box sx={{ display: 'flex', gap: 'var(--Pad)' }}>
          <Typography level='h4'>
            <ChatBeamIcon color='primary' sx={{
              animation: `${cssRainbowColorKeyframes} 2s linear 2.66`,
            }} />
          </Typography>
          <div>
            <Typography level='h4' component='h2'>
              {Brand.Title.Base} Beam
            </Typography>

            <Typography level='body-sm'>
              Combine the smarts of many models into one
            </Typography>
          </div>
        </Box>

        {/* LLM cell */}
        <Box sx={{ display: 'flex', gap: 'calc(var(--Pad) / 2)', alignItems: 'center', justifyContent: isMobile ? undefined : 'center' }}>
          {allChatLlmComponent}
          {/*<Button variant='solid' color='neutral' onClick={handleClose}>*/}
          {/*  Close*/}
          {/*</Button>*/}
        </Box>

        {/* Count and Start cell */}
        <Box sx={{
          // gridColumn: '1 / -1',
          display: 'flex', gap: 'calc(var(--Pad) / 2)', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Box sx={{ flex: 1, display: 'flex', '& > *': { flex: 0 } }}>
            {[2, 4, 8].map((n) => (
              <Button
                key={n}
                variant={tempRepeat === n ? 'soft' : 'plain'} color='neutral'
                onClick={() => setTempRepeat(n)}
                sx={{ fontWeight: tempRepeat === n ? 'xl' : 400 /* reset, from 600 */ }}
              >
                {`x${n}`}
              </Button>
            ))}
          </Box>

          <Button variant='solid' color='primary' onClick={handleClose}>
            Start
          </Button>
        </Box>

      </Sheet>


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