import * as React from 'react';
import { keyframes } from '@emotion/react';

import type { SxProps } from '@mui/joy/styles/types';
import { Alert, Box, Button, Sheet, Typography } from '@mui/joy';

import { ConversationHandler } from '~/common/chats/ConversationHandler';
import { useBeam } from '~/common/chats/BeamStore';
import { useLLMSelect } from '~/common/components/forms/useLLMSelect';


export const animationEnter = keyframes`
    0% {
        opacity: 0;
        transform: translateY(8px);
        scale: 0.9;
    }
    100% {
        opacity: 1;
        transform: translateY(0);
        scale: 1;
    }
`;

export function BeamView(props: {
  conversationHandler: ConversationHandler,
  isMobile: boolean,
  sx?: SxProps
}) {

  // state
  const { config, candidates } = useBeam(props.conversationHandler);

  // external state
  const [allChatLlm, allChatLlmComponent] = useLLMSelect(true, 'Beam LLM');

  const handleClose = React.useCallback(() => {
    props.conversationHandler.beamStore.destroy();
  }, [props.conversationHandler.beamStore]);

  if (!config)
    return null;

  const lastMessage = config.history.slice(-1)[0] ?? null;

  return (
    <Box sx={{
      ...props.sx,

      // animation
      animation: `${animationEnter} 0.42s cubic-bezier(.17,.84,.44,1)`,

      // layout
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      px: { xs: 1, md: 2 },
    }}>

      {/* Issues */}
      {!!config.configError && (
        <Alert>
          {config.configError}
        </Alert>
      )}

      {/* Models,  [x] all same, */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'start', gap: 2 }}>
        <Box sx={{ minWidth: 200 }}>
          {allChatLlmComponent}
        </Box>

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
        <Sheet sx={{ minHeight: '50%' }}>
          b
        </Sheet>
        <Sheet>
          a
        </Sheet>
        <Sheet>
          a
        </Sheet>
        <Sheet>
          a
        </Sheet>
        <Sheet>
          a
        </Sheet>
        <Sheet>
          a
        </Sheet>
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