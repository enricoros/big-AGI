import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { MenuItem, Switch, Typography } from '@mui/joy';

import { useUIPreferencesStore } from '~/common/state/store-ui';


/**
 * Menu Items are the settings for the chat.
 */
export function AppChatLinkMenuItems() {

  // external state
  const {
    showSystemMessages, setShowSystemMessages,
    renderMarkdown, setRenderMarkdown,
    zenMode, setZenMode,
  } = useUIPreferencesStore(state => ({
    showSystemMessages: state.showSystemMessages, setShowSystemMessages: state.setShowSystemMessages,
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    zenMode: state.zenMode, setZenMode: state.setZenMode,
  }), shallow);


  const handleRenderSystemMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowSystemMessages(event.target.checked);
  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);
  const handleZenModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setZenMode(event.target.checked ? 'cleaner' : 'clean');

  const zenOn = zenMode === 'cleaner';


  return <>

    <MenuItem onClick={() => setShowSystemMessages(!showSystemMessages)} sx={{ justifyContent: 'space-between' }}>
      <Typography>
        System message
      </Typography>
      <Switch
        checked={showSystemMessages} onChange={handleRenderSystemMessageChange}
        // endDecorator={showSystemMessages ? 'On' : 'Off'}
        slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
      />
    </MenuItem>

    <MenuItem onClick={() => setRenderMarkdown(!renderMarkdown)} sx={{ justifyContent: 'space-between' }}>
      <Typography>
        Markdown
      </Typography>
      <Switch
        checked={renderMarkdown} onChange={handleRenderMarkdownChange}
        // endDecorator={renderMarkdown ? 'On' : 'Off'}
        slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
      />
    </MenuItem>

    <MenuItem onClick={() => setZenMode(zenOn ? 'clean' : 'cleaner')} sx={{ justifyContent: 'space-between' }}>
      <Typography>
        Zen
      </Typography>
      <Switch
        checked={zenOn} onChange={handleZenModeChange}
        // endDecorator={zenOn ? 'On' : 'Off'}
        slotProps={{ endDecorator: { sx: { minWidth: 26 } } }}
      />
    </MenuItem>

  </>;
}