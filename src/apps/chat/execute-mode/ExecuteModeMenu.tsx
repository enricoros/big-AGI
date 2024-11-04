import * as React from 'react';

import { Box, MenuItem, Radio, Typography } from '@mui/joy';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { KeyStroke, platformAwareKeystrokes } from '~/common/components/KeyStroke';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import type { ChatExecuteMode } from './execute-mode.types';
import { ExecuteModeItems } from './execute-mode.items';


export function ExecuteModeMenu(props: {
  isMobile: boolean,
  hasCapabilityT2I: boolean,
  anchorEl: HTMLAnchorElement | null,
  onClose: () => void,
  chatExecuteMode: ChatExecuteMode,
  onSetChatExecuteMode: (chatExecuteMode: ChatExecuteMode) => void,
}) {

  // external state
  const enterIsNewline = useUIPreferencesStore(state => state.enterIsNewline);

  return (
    <CloseableMenu
      placement='top-end'
      open={true} anchorEl={props.anchorEl} onClose={props.onClose}
      sx={{ minWidth: 320 }}
    >

      {/*<MenuItem color='neutral' selected>*/}
      {/*  Conversation Mode*/}
      {/*</MenuItem>*/}
      {/**/}
      {/*<ListDivider />*/}

      {/* Items */}
      {Object.entries(ExecuteModeItems)
        .filter(([_key, data]) => !data.hideOnDesktop || props.isMobile)
        .map(([key, data]) =>
          <MenuItem key={'chat-mode-' + key} onClick={() => props.onSetChatExecuteMode(key as ChatExecuteMode)}>
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Radio color={data.highlight ? 'success' : undefined} checked={key === props.chatExecuteMode} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography>{data.label}</Typography>
                <Typography level='body-xs'>{data.description}{(data.requiresTTI && !props.hasCapabilityT2I) ? 'Unconfigured' : ''}</Typography>
              </Box>
              {(key === props.chatExecuteMode || !!data.shortcut) && (
                <KeyStroke variant='outlined' combo={platformAwareKeystrokes(
                  newLineShortcut(
                    (key === props.chatExecuteMode) ? 'ENTER'
                      : data.shortcut ? data.shortcut
                        : 'ENTER',
                    enterIsNewline,
                  ),
                )} />
              )}
            </Box>
          </MenuItem>,
        )}

    </CloseableMenu>
  );
}

function newLineShortcut(shortcut: string, enterIsNewLine: boolean) {
  if (shortcut === 'ENTER')
    return enterIsNewLine ? 'Shift + Enter' : 'Enter';
  return shortcut;
}
