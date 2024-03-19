import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { ChatMessageMemo } from '../../../apps/chat/components/message/ChatMessage';

import { createDMessage } from '~/common/state/store-chats';


const gatherConfigWrapperSx: SxProps = {
  px: 'var(--Pad)',
  mb: 'calc(-1 * var(--Pad))', // absorb gap to the next-top
};

const configChatMessageSx: SxProps = {
  backgroundColor: 'success.softBg',
  border: '1px solid',
  borderColor: 'success.outlinedBorder',
  borderRadius: 'md',
  borderBottom: 'none',
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
  px: '0.5rem',
} as const;


export function BeamGatherConfig(props: {
  isMobile: boolean,
  fusionIndex: number | null
}) {



  return (
    <Box sx={gatherConfigWrapperSx}>
      <ChatMessageMemo
        message={createDMessage('assistant', 'Gather the messages you want to merge.')}
        fitScreen={props.isMobile}
        showAvatar={false}
        adjustContentScaling={-1}
        sx={configChatMessageSx}
      />
    </Box>
  );
}