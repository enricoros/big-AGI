import * as React from 'react';

import { Box, MenuItem, Radio, Typography } from '@mui/joy';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { KeyStroke } from '~/common/components/KeyStroke';
import { useUIPreferencesStore } from '~/common/state/store-ui';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { ChatModeId } from '../../AppChat';


interface ChatModeDescription {
  label: string;
  description: string | React.JSX.Element;
  shortcut?: string;
  experimental?: boolean;
}

const ChatModeItems: { [key in ChatModeId]: ChatModeDescription } = {
  'immediate': {
    label: 'Chat',
    description: 'Persona replies',
  },
  'write-user': {
    label: 'Write',
    description: 'Appends a message',
    shortcut: 'Alt + Enter',
  },
  'draw-imagine': {
    label: 'Draw',
    description: 'AI Image Generation',
  },
  'draw-imagine-plus': {
    label: 'Assisted Draw',
    description: 'Assisted Image Generation',
    experimental: true,
  },
  'react': {
    label: 'Reason + Act · α',
    description: 'Answers questions in multiple steps',
  },
};


function fixNewLineShortcut(shortcut: string, enterIsNewLine: boolean) {
  if (shortcut === 'ENTER')
    return enterIsNewLine ? 'Shift + Enter' : 'Enter';
  return shortcut;
}

export function ChatModeMenu(props: { anchorEl: HTMLAnchorElement | null, onClose: () => void, chatModeId: ChatModeId, onSetChatModeId: (chatMode: ChatModeId) => void }) {

  // external state
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);
  const labsMagicDraw = useUXLabsStore(state => state.labsMagicDraw);

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
      .filter(([, { experimental }]) => labsMagicDraw || !experimental)
      .map(([key, data]) =>
        <MenuItem key={'chat-mode-' + key} onClick={() => props.onSetChatModeId(key as ChatModeId)}>
          <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Radio checked={key === props.chatModeId} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography>{data.label}</Typography>
              <Typography level='body-xs'>{data.description}</Typography>
            </Box>
            {(key === props.chatModeId || !!data.shortcut) && (
              <KeyStroke combo={fixNewLineShortcut((key === props.chatModeId) ? 'ENTER' : data.shortcut ? data.shortcut : 'ENTER', enterIsNewline)} />
            )}
          </Box>
        </MenuItem>)}

  </CloseableMenu>;
}