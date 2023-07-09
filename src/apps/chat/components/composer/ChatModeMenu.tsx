import * as React from 'react';

import { Box, ListDivider, Menu, MenuItem, Radio, Typography } from '@mui/joy';

import { ChatModeId, ChatModeItems } from '../../AppChat';


export const ChatModeMenu = (props: { anchorEl: HTMLAnchorElement, onClose: () => void, experimental: boolean, chatModeId: ChatModeId, onSetChatModeId: (chatMode: ChatModeId) => void }) =>
  <Menu
    variant='outlined' color='neutral' size='md' placement='top-end' sx={{ minWidth: 320, overflow: 'auto' }}
    open anchorEl={props.anchorEl} onClose={props.onClose}>

    {/*<MenuItem color='neutral' selected>*/}
    {/*  Conversation Mode*/}
    {/*</MenuItem>*/}
    {/**/}
    {/*<ListDivider />*/}

    {Object.entries(ChatModeItems).filter(([, { experimental }]) => props.experimental || !experimental).map(([key, data]) =>
      <MenuItem key={'chat-mode-' + key} onClick={() => props.onSetChatModeId(key as ChatModeId)}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Radio checked={key === props.chatModeId} />
          <Box>
            <Typography>{data.label}</Typography>
            <Typography level='body2'>{data.description}</Typography>
          </Box>
        </Box>
      </MenuItem>)}

  </Menu>;