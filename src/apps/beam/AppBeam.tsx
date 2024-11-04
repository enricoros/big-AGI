import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Typography } from '@mui/joy';

import { BeamStoreApi, useBeamStore } from '~/modules/beam/store-beam.hooks';
import { BeamView } from '~/modules/beam/BeamView';
import { createBeamVanillaStore } from '~/modules/beam/store-beam_vanilla';

import { OptimaToolbarIn } from '~/common/layout/optima/portals/OptimaPortalsIn';
import { createDConversation, DConversation } from '~/common/stores/chat/chat.conversation';
import { createDMessageTextContent, DMessage } from '~/common/stores/chat/chat.message';
import { getChatLLMId } from '~/common/stores/llms/store-llms';
import { useIsMobile } from '~/common/components/useMatchMedia';


function initTestConversation(): DConversation {
  const conversation = createDConversation();
  conversation.messages.push(createDMessageTextContent('system', 'You are a helpful assistant.')); // Beam Test - seed1
  conversation.messages.push(createDMessageTextContent('user', 'Hello, who are you? (please expand...)')); // Beam Test - seed2
  return conversation;
}

function initTestBeamStore(messages: DMessage[], beamStore: BeamStoreApi = createBeamVanillaStore()): BeamStoreApi {
  beamStore.getState().open(messages, getChatLLMId(), false, (content) => alert(content));
  return beamStore;
}


export function AppBeam() {

  // state
  const [showDebug, setShowDebug] = React.useState(false);

  const [conversation, setConversation] = React.useState<DConversation>(() => initTestConversation());
  const [beamStoreApi] = React.useState(() => createBeamVanillaStore());


  // reinit the beam store if the conversation changes
  React.useEffect(() => {
    initTestBeamStore(conversation.messages, beamStoreApi);
  }, [beamStoreApi, conversation]);


  // external state
  const isMobile = useIsMobile();
  const { isOpen, beamState } = useBeamStore(beamStoreApi, useShallow(state => {
    return {
      isOpen: state.isOpen,
      beamState: showDebug ? state : null,
    };
  }));


  const handleClose = React.useCallback(() => {
    beamStoreApi.getState().terminateKeepingSettings();
  }, [beamStoreApi]);


  const toolbarItems = React.useMemo(() => <>
    {/* button to toggle debug info */}
    <Button size='sm' variant='plain' color='neutral' onClick={() => setShowDebug(on => !on)}>
      {showDebug ? 'Hide' : 'Show'} debug
    </Button>

    {/* 'open' */}
    <Button size='sm' variant='plain' color='neutral' onClick={() => setConversation(initTestConversation())}>
      .open
    </Button>

    {/* 'close' */}
    <Button size='sm' variant='plain' color='neutral' onClick={handleClose}>
      .close
    </Button>
  </>, [handleClose, showDebug]);


  return <>
    <OptimaToolbarIn>{toolbarItems}</OptimaToolbarIn>

    <Box sx={{ flexGrow: 1, overflowY: 'auto', position: 'relative' }}>

      {isOpen && (
        <BeamView
          beamStore={beamStoreApi}
          isMobile={isMobile}
        />
      )}

      {showDebug && (
        <Typography level='body-xs' sx={{
          whiteSpace: 'pre',
          position: 'absolute',
          inset: 0,
          zIndex: 1 /* debug on top of BeamView */,
          backdropFilter: 'blur(4px)',
          padding: '1rem',
        }}>
          {JSON.stringify(beamState, null, 2)
            // add an extra newline between first level properties (space, space, double quote) to make it more readable
            .split('\n').map(line => line.replace(/^\s\s"/g, '\n  ')).join('\n')}
        </Typography>
      )}

    </Box>

  </>;
}