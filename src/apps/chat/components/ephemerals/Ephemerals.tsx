import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, ModalClose, Sheet, Typography } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { useChatStore } from '@/common/state/store-chats';

import { RenderText } from '../message/ChatMessage';


export function Ephemerals(props: { conversationId: string | null, sx?: SxProps }) {
  const ephemerals = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return conversation ? conversation.ephemerals : [];
  }, shallow);

  if (!ephemerals?.length) return null;

  return (
    <Sheet
      variant='soft' color='info' invertedColors
      sx={{
        maxHeight: '30vh', overflow: 'auto',
        position: 'relative',
        ...(props.sx || {}),
      }}>

      {ephemerals.map((block, i) => (
        <Box key={`ephemeral-${i}`}>
          <ModalClose />
          {block.title && <Typography level='h5'>{block.title}</Typography>}
          <RenderText textBlock={{ type: 'text', content: block.text }} sx={{ fontSize: '12px' }} />
        </Box>
      ))}

    </Sheet>
  );
}
