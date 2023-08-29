import * as React from 'react';

import { Box, MenuItem, Radio, Typography } from '@mui/joy';

import { ChatModeId, ChatModeItems } from '../../AppChat';

import { CloseableMenu } from '~/common/components/CloseableMenu';


export const ChatModeMenu = (props: { anchorEl: HTMLAnchorElement | null, onClose: () => void, experimental: boolean, chatModeId: ChatModeId, onSetChatModeId: (chatMode: ChatModeId) => void }) =>
  <CloseableMenu
    placement='top-end' sx={{ minWidth: 320 }}
    open anchorEl={props.anchorEl} onClose={props.onClose}
  >

    {/*<MenuItem color='neutral' selected>*/}
    {/*  Conversation Mode*/}
    {/*</MenuItem>*/}
    {/**/}
    {/*<ListDivider />*/}

    {/* ChatMode items */}
    {Object.entries(ChatModeItems).filter(([, { experimental }]) => props.experimental || !experimental).map(([key, data]) =>
      <MenuItem key={'chat-mode-' + key} onClick={() => props.onSetChatModeId(key as ChatModeId)}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Radio checked={key === props.chatModeId} />
          <Box>
            <Typography>{data.label}</Typography>
            <Typography level='body-sm'>{data.description}</Typography>
          </Box>
        </Box>
      </MenuItem>)}

  </CloseableMenu>;