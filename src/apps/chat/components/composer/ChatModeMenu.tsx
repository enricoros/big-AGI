import * as React from 'react';

import { Badge, Box, MenuItem, Radio, Typography } from '@mui/joy';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { KeyStroke, platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { ChatModeId } from '../../AppChat';
import { useUXLabsStore } from '~/common/state/store-ux-labs';


interface ChatModeDescription {
  label: string;
  description: string | React.JSX.Element;
  highlight?: boolean;
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
  'generate-text-beam': {
    label: 'Beam', // Best of, Auto-Prime, Top Pick, Select Best
    description: 'Combine multiple models', // Smarter: combine...
    highlight: true,
    shortcut: 'Ctrl + Enter'
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
  const labsChatBeam = useUXLabsStore(state => state.labsChatBeam);
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
        .filter(([key, data]) => key !== 'generate-text-beam' || labsChatBeam)
        .map(([key, data]) =>
          <MenuItem key={'chat-mode-' + key} onClick={() => props.onSetChatModeId(key as ChatModeId)}>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Badge invisible={!data.highlight} color='success' size='sm'>
                <Radio color={data.highlight ? 'success' : undefined} checked={key === props.chatModeId} />
              </Badge>
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