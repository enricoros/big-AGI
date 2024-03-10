import * as React from 'react';

import { Box, Button, Typography } from '@mui/joy';

import { useModelsStore } from '~/modules/llms/store-llms';

import { BeamStoreApi, createBeamStore, useBeamStore } from '~/common/chats/store-beam';
import { createDConversation, createDMessage, DConversation } from '~/common/state/store-chats';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';

import { BeamView } from '../chat/components/beam/BeamView';


function initTestConversation(): DConversation {
  const conversation = createDConversation();
  conversation.messages.push(createDMessage('system', 'You are a helpful assistant.'));
  conversation.messages.push(createDMessage('user', 'Hello, who are you?'));
  return conversation;
}

function initTestBeam(conversation: DConversation): BeamStoreApi {
  const beamStore = createBeamStore();
  beamStore.getState().open(conversation.messages, useModelsStore.getState().chatLLMId);
  return beamStore;
}


export function AppBeam() {

  // state
  const conversation = React.useRef<DConversation>(initTestConversation()).current;
  const beamStoreApi = React.useRef(initTestBeam(conversation)).current;
  const [showDebug, setShowDebug] = React.useState(false);

  // external state
  const isMobile = useIsMobile();
  useBeamStore(beamStoreApi, state => state); // force re-render on state change

  // layout
  usePluggableOptimaLayout(null, React.useMemo(() => (
    <Button size='sm' variant='soft' color='neutral' onClick={() => setShowDebug(on => !on)}>
      {showDebug ? 'Hide' : 'Show'} debug info
    </Button>
  ), [showDebug]), null, 'AppBeam');

  return (
    <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
      {showDebug ? (
        <Typography level='body-xs' sx={{ whiteSpace: 'pre' }}>
          {JSON.stringify({ conversationId: conversation.id }, null, 2) + '\n'}
          {JSON.stringify(beamStoreApi.getState(), null, 2)}
        </Typography>
      ) : (
        <BeamView beamStore={beamStoreApi} isMobile={isMobile} sx={{
          // backgroundColor: 'background.level3',
          height: '100%',
        }} />
      )}
    </Box>
  );
}