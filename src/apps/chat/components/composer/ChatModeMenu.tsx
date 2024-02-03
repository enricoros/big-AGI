import * as React from 'react';

import { Box, MenuItem, Radio, Typography } from '@mui/joy';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { KeyStroke } from '~/common/components/KeyStroke';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatModeId } from '../../AppChat';


interface ChatModeDescription {
  label: string;
  description: string | React.JSX.Element;
  shortcut?: string;
  requiresTTI?: boolean;
}

const ChatModeItems: { [key in ChatModeId]: ChatModeDescription } = {
  'generate-text': {
    label: 'Chat',
    description: 'Persona replies',
  },
  'append-user': {
    label: 'Write',
    description: 'Appends a message',
    shortcut: 'Alt + Enter',
  },
  'generate-image': {
    label: 'Draw',
    description: 'AI Image Generation',
    requiresTTI: true,
  },
  'generate-best-of': {
    label: 'Best-Of', // Best of, Auto-Prime, Top Pick, Select Best
    description: 'Smarter: best of multiple replies',
  },
  'generate-react': {
    label: 'Reason + Act', //  · α
    description: 'Answers questions in multiple steps',
  },
};


function fixNewLineShortcut(shortcut: string, enterIsNewLine: boolean) {
  if (shortcut === 'ENTER')
    return enterIsNewLine ? 'Shift + Enter' : 'Enter';
  return shortcut;
}

export function ChatModeMenu(props: {
  anchorEl: HTMLAnchorElement | null, onClose: () => void,
  chatModeId: ChatModeId, onSetChatModeId: (chatMode: ChatModeId) => void
  capabilityHasTTI: boolean,
}) {

  // external state
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);

  return (
    <CloseableMenu
      placement='top-end'
      open anchorEl={props.anchorEl} onClose={props.onClose}
      sx={{ minWidth: 320 }}
    >

      {/*<MenuItem color='neutral' selected>*/}
      {/*  Conversation Mode*/}
      {/*</MenuItem>*/}
      {/**/}
      {/*<ListDivider />*/}

      {/* ChatMode items */}
      {Object.entries(ChatModeItems)
        .map(([key, data]) =>
          <MenuItem key={'chat-mode-' + key} onClick={() => props.onSetChatModeId(key as ChatModeId)}>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Radio checked={key === props.chatModeId} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography>{data.label}</Typography>
                <Typography level='body-xs'>{data.description}{(data.requiresTTI && !props.capabilityHasTTI) ? 'Unconfigured' : ''}</Typography>
              </Box>
              {(key === props.chatModeId || !!data.shortcut) && (
                <KeyStroke combo={fixNewLineShortcut((key === props.chatModeId) ? 'ENTER' : data.shortcut ? data.shortcut : 'ENTER', enterIsNewline)} />
              )}
            </Box>
          </MenuItem>)}

    </CloseableMenu>
  );
}