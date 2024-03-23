import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { Box, Button, Typography } from '@mui/joy';

import { useModelsStore } from '~/modules/llms/store-llms';

import { BeamStoreApi, useBeamStore } from '~/common/beam/store-beam.hooks';
import { BeamView } from '~/common/beam/BeamView';
import { createBeamStore } from '~/common/beam/store-beam';
import { createDConversation, createDMessage, DConversation, DMessage } from '~/common/state/store-chats';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { usePluggableOptimaLayout } from '~/common/layout/optima/useOptimaLayout';


function initTestConversation(): DConversation {
  const conversation = createDConversation();
  conversation.messages.push(createDMessage('system', 'You are a helpful assistant.'));
  conversation.messages.push(createDMessage('user', 'Hello, who are you? (please expand...)'));
  return conversation;
}

function initTestBeamStore(messages: DMessage[], beamStore: BeamStoreApi = createBeamStore()): BeamStoreApi {
  beamStore.getState().open(messages, useModelsStore.getState().chatLLMId, () => null);
  return beamStore;
}


export function AppBeam() {

  // state
  const [showDebug, setShowDebug] = React.useState(false);
  const conversation = React.useRef<DConversation>(initTestConversation());
  const beamStoreApi = React.useRef(initTestBeamStore(conversation.current.messages)).current;

  // external state
  const isMobile = useIsMobile();
  const { isOpen, beamState } = useBeamStore(beamStoreApi, useShallow(state => {
    return {
      isOpen: state.isOpen,
      beamState: showDebug ? state : null,
    };
  }));


  const handleClose = React.useCallback(() => {
    beamStoreApi.getState().terminate();
  }, [beamStoreApi]);


  // layout
  usePluggableOptimaLayout(null, React.useMemo(() => <>
    {/* button to toggle debug info */}
    <Button size='sm' variant='plain' color='neutral' onClick={() => setShowDebug(on => !on)}>
      {showDebug ? 'Hide' : 'Show'} debug
    </Button>

    {/* 'open' */}
    <Button size='sm' variant='plain' color='neutral' onClick={() => {
      conversation.current = initTestConversation();
      initTestBeamStore(conversation.current.messages, beamStoreApi);
    }}>
      .open
    </Button>

    {/* 'close' */}
    <Button size='sm' variant='plain' color='neutral' onClick={handleClose}>
      .close
    </Button>
  </>, [beamStoreApi, handleClose, showDebug]), null, 'AppBeam');


  return (
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
          backdropFilter: 'blur(8px)',
          padding: '1rem',
        }}>
          {JSON.stringify({ conversationId: conversation.current.id, beamState }, null, 2)}
        </Typography>
      )}

    </Box>
  );
}