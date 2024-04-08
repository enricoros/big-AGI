import * as React from 'react';

import { Box, FormControl, FormLabel, IconButton, Switch } from '@mui/joy';

import { ChatMulticastOnIcon } from '~/common/components/icons/ChatMulticastOnIcon';
import { ChatMulticastOffIcon } from '~/common/components/icons/ChatMulticastOffIcon';


export const ButtonMultiChatMemo = React.memo(ButtonMultiChat);

export function ButtonMultiChat(props: { isMobile?: boolean, multiChat: boolean, onSetMultiChat: (multiChat: boolean) => void }) {
  const { multiChat } = props;
  return props.isMobile ? (
    <IconButton
      variant={multiChat ? 'solid' : 'outlined'}
      color={multiChat ? 'warning' : undefined}
      onClick={() => props.onSetMultiChat(!multiChat)}
    >
      {multiChat ? <ChatMulticastOnIcon /> : <ChatMulticastOffIcon />}
    </IconButton>
  ) : (
    <FormControl orientation='horizontal' sx={{ minHeight: '2.25rem', justifyContent: 'space-between' }}>
      <FormLabel sx={{ gap: 1, flexFlow: 'row nowrap' }}>
        <Box sx={{ display: { xs: 'none', lg: 'inline-block' } }}>
          {multiChat ? <ChatMulticastOnIcon color='primary' /> : <ChatMulticastOffIcon />}
        </Box>
        {multiChat ? 'Multichat · On' : 'Multichat'}
      </FormLabel>
      <Switch color={multiChat ? 'primary' : undefined} checked={multiChat} onChange={(e) => props.onSetMultiChat(e.target.checked)} />
    </FormControl>
  );
}