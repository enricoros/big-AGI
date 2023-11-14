import * as React from 'react';

import { Box, MenuItem, Radio, Typography } from '@mui/joy';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { KeyStroke } from '~/common/components/KeyStroke';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatModeId, ChatModeItems } from './store-composer';


function fixNewLineShortcut(shortcut: string, enterIsNewLine: boolean) {
  if (shortcut === 'ENTER')
    return enterIsNewLine ? 'Shift + Enter' : 'Enter';
  return shortcut;
}

export const ChatModeMenu = (props: { anchorEl: HTMLAnchorElement | null, onClose: () => void, experimental: boolean, chatModeId: ChatModeId, onSetChatModeId: (chatMode: ChatModeId) => void }) => {

  // external state
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);

  return <CloseableMenu
    placement='top-end' sx={{ minWidth: 320 }}
    open anchorEl={props.anchorEl} onClose={props.onClose}
  >

    {/*<MenuItem color='neutral' selected>*/}
    {/*  Conversation Mode*/}
    {/*</MenuItem>*/}
    {/**/}
    {/*<ListDivider />*/}

    {/* ChatMode items */}
    {Object.entries(ChatModeItems)
      .filter(([, { experimental }]) => props.experimental || !experimental)
      .map(([key, data]) =>
        <MenuItem key={'chat-mode-' + key} onClick={() => props.onSetChatModeId(key as ChatModeId)}>
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Radio checked={key === props.chatModeId} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography>{data.label}</Typography>
              <Typography level='body-xs'>{data.description}</Typography>
            </Box>
            {(key === props.chatModeId || !!data.shortcut) && (
              <KeyStroke combo={fixNewLineShortcut((key === props.chatModeId) ? 'ENTER' : data.shortcut ? data.shortcut : "ENTER", enterIsNewline)} />
            )}
          </Box>
        </MenuItem>)}

  </CloseableMenu>;
};