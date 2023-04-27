import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, IconButton, Sheet, Typography, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CloseIcon from '@mui/icons-material/Close';

import { useChatStore } from '@/common/state/store-chats';


export function Ephemerals(props: { conversationId: string | null, sx?: SxProps }) {
  // global state
  const theme = useTheme();
  const ephemerals = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return conversation ? conversation.ephemerals : [];
  }, shallow);

  if (!ephemerals?.length) return null;

  const handleDeleteEphemeral = (ephemeralId: string) => {
    if (props.conversationId && ephemeralId)
      useChatStore.getState().deleteEphemeral(props.conversationId, ephemeralId);
  };

  return (
    <Sheet variant='soft' color='info' invertedColors sx={props.sx}>

      {ephemerals.map((ephemeral, i) => (
        <Box
          key={`ephemeral-${i}`}
          sx={{
            p: { xs: 1, md: 2 },
            position: 'relative',
            borderBottom: (i < ephemerals.length - 1) ? `1px solid ${theme.vars.palette.divider}` : undefined,
          }}>

          <IconButton size='sm' sx={{ float: 'right' }} onClick={() => handleDeleteEphemeral(ephemeral.id)}>
            <CloseIcon />
          </IconButton>

          {ephemeral.title && (
            <Typography>
              {ephemeral.title}
            </Typography>
          )}

          <Typography fontSize='smaller' sx={{ overflowWrap: 'anywhere', whiteSpace: 'break-spaces' }}>
            {ephemeral.text}
          </Typography>
        </Box>
      ))}

    </Sheet>
  );
}
