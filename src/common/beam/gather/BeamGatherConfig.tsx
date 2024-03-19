import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { createDMessage } from '~/common/state/store-chats';
import { BeamStoreApi, useBeamStore } from '~/common/beam/store-beam.hooks';


const gatherConfigWrapperSx: SxProps = {
  mx: 'var(--Pad)',
  // px: '0.5rem',
  mb: 'calc(-1 * var(--Pad))', // absorb gap to the next-top
  backgroundColor: 'success.softBg',

  border: '1px solid',
  borderColor: 'success.outlinedBorder',
  borderRadius: 'md',
  borderBottom: 'none',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
};

const configChatMessageSx: SxProps = {
  backgroundColor: 'transparent',
  borderBottom: 'none',
  px: '0.25rem',
};


export function BeamGatherConfig(props: {
  beamStore: BeamStoreApi
  fusionIndex: number | null,
  isMobile: boolean,
}) {

  // external state
  const fusion = useBeamStore(props.beamStore, store => props.fusionIndex !== null ? store.fusions[props.fusionIndex] ?? null : null);

  const userPromptMessage = React.useMemo(() => {
    return fusion?.userPrompt ? createDMessage('assistant', fusion.userPrompt) : null;
  }, [fusion?.userPrompt]);

  if (!userPromptMessage)
    return null;

  return (
    <Box sx={gatherConfigWrapperSx}>
      <ChatMessageMemo
        message={userPromptMessage}
        fitScreen={props.isMobile}
        showAvatar={false}
        adjustContentScaling={-1}
        sx={configChatMessageSx}
      />
    </Box>
  );
}