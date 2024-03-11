import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';

import { useModelsStore } from '~/modules/llms/store-llms';

import { BeamView } from '~/common/beam/BeamView';
import { BeamStoreApi, createBeamStore, useBeamStore } from '~/common/beam/store-beam';
import { createDConversation, createDMessage, DConversation, DMessage } from '~/common/state/store-chats';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';


function initTestConversation(): DConversation {
  const conversation = createDConversation();
  conversation.messages.push(createDMessage('system', 'You are a helpful assistant.'));
  conversation.messages.push(createDMessage('user', 'Hello, who are you?'));
  return conversation;
}

function initTestBeam(messages: DMessage[]): BeamStoreApi {
  const beamStore = createBeamStore();
  beamStore.getState().open(messages, useModelsStore.getState().chatLLMId);
  return beamStore;
}


export function AppBeam() {

  // state
  const conversation = React.useRef<DConversation>(initTestConversation());
  const beamStoreApi = React.useRef(initTestBeam(conversation.current.messages)).current;
  const [showDebug, setShowDebug] = React.useState(false);

  // external state
  const isMobile = useIsMobile();
  const beamState = useBeamStore(beamStoreApi, state => state); // force re-render (of the JSON) on state change

  // layout
  usePluggableOptimaLayout(null, React.useMemo(() => <>
    {/* button to toggle debug info */}
    <Button size='sm' variant='plain' color='neutral' onClick={() => setShowDebug(on => !on)}>
      {showDebug ? 'Hide' : 'Show'} debug
    </Button>

    {/* 'open' */}
    <Button size='sm' variant='plain' color='neutral' onClick={() => {
      conversation.current = initTestConversation();
      beamStoreApi.getState().open(conversation.current.messages, useModelsStore.getState().chatLLMId);
    }}>
      .open
    </Button>

    {/* 'close' */}
    <Button size='sm' variant='plain' color='neutral' onClick={() => beamStoreApi.getState().close()}>
      .close
    </Button>
  </>, [beamStoreApi, showDebug]), null, 'AppBeam');

  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto', position: 'relative' }}>

      <BeamView beamStore={beamStoreApi} isMobile={isMobile} sx={{ height: '100%' }} />

      {showDebug && (
        <Typography level='body-xs' sx={{ whiteSpace: 'pre', position: 'absolute', inset: 0, zIndex: 1, backdropFilter: 'blur(8px)', padding: '1rem' }}>
          {JSON.stringify({ conversationId: conversation.current.id, beamStore: beamState }, null, 2)}
        </Typography>
      )}

    </Box>
  );
}