import * as React from 'react';

import { Box, MenuItem, Radio, Typography } from '@mui/joy';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { KeyStroke, platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatModeId } from '../../AppChat';


interface ChatModeDescription {
  label: string;
  description: string | React.JSX.Element;
  highlight?: boolean;
  shortcut?: string;
  hideOnDesktop?: boolean;
  requiresTTI?: boolean;
}

const ChatModeItems: { [key in ChatModeId]: ChatModeDescription } = {
  'generate-text': {
    label: 'Chat',
    description: 'Persona replies',
  },
  'generate-text-beam': {
    label: 'Beam', // Best of, Auto-Prime, Top Pick, Select Best
    description: 'Combine multiple models', // Smarter: combine...
    shortcut: 'Ctrl + Enter',
    hideOnDesktop: true,
  },
  'append-user': {
    label: 'Write',
    description: 'Append a message',
    shortcut: 'Alt + Enter',
  },
  'generate-image': {
    label: 'Draw',
    description: 'AI Image Generation',
    requiresTTI: true,
  },
  'generate-react': {
    label: 'Reason + Act', //  · α
    description: 'Answer questions in multiple steps',
  },
};


function fixNewLineShortcut(shortcut: string, enterIsNewLine: boolean) {
  if (shortcut === 'ENTER')
    return enterIsNewLine ? 'Shift + Enter' : 'Enter';
  return shortcut;
}

export function ChatModeMenu(props: {
  isMobile: boolean,
  anchorEl: HTMLAnchorElement | null,
  onClose: () => void,
  chatModeId: ChatModeId,
  onSetChatModeId: (chatMode: ChatModeId) => void,
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
        .filter(([_key, data]) => !data.hideOnDesktop || props.isMobile)
        .map(([key, data]) =>
          <MenuItem key={'chat-mode-' + key} onClick={() => props.onSetChatModeId(key as ChatModeId)}>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Radio color={data.highlight ? 'success' : undefined} checked={key === props.chatModeId} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography>{data.label}</Typography>
                <Typography level='body-xs'>{data.description}{(data.requiresTTI && !props.capabilityHasTTI) ? 'Unconfigured' : ''}</Typography>
              </Box>
              {(key === props.chatModeId || !!data.shortcut) && (
                <KeyStroke combo={platformAwareKeystrokes(fixNewLineShortcut((key === props.chatModeId) ? 'ENTER' : data.shortcut ? data.shortcut : 'ENTER', enterIsNewline))} />
              )}
            </Box>
          </MenuItem>)}

    </CloseableMenu>
  );
}