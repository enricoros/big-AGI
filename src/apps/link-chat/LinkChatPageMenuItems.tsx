import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { ListDivider, ListItemDecorator, MenuItem, Switch, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { SettingContentScaling } from '../settings-modal/settings-ui/SettingContentScaling';

import { useUIPreferencesStore } from '~/common/state/store-ui';

import { useChatShowSystemMessages } from '../chat/store-app-chat';


/**
 * Menu Items are the settings for the chat.
 */
export function LinkChatPageMenuItems(props: {
  activeLinkId: string | null,
  onDeleteLink: (linkId: string) => void,
}) {

  // external state
  const [showSystemMessages, setShowSystemMessages] = useChatShowSystemMessages();
  const {
    renderMarkdown, setRenderMarkdown,
    zenMode, setZenMode,
  } = useUIPreferencesStore(state => ({
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
    zenMode: state.zenMode, setZenMode: state.setZenMode,
  }), shallow);


  const handleRenderSystemMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowSystemMessages(event.target.checked);

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const handleZenModeChange = (event: React.ChangeEvent<HTMLInputElement>) => setZenMode(event.target.checked ? 'cleaner' : 'clean');

  const { activeLinkId, onDeleteLink } = props;

  const handleDeleteLink = React.useCallback(() => {
    activeLinkId && onDeleteLink(activeLinkId);
  }, [activeLinkId, onDeleteLink]);


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

    <SettingContentScaling noLabel />

    <ListDivider />

    <MenuItem onClick={handleDeleteLink} sx={{ justifyContent: 'space-between' }}>
      Delete
      <ListItemDecorator>
        <DeleteOutlineIcon />
      </ListItemDecorator>
    </MenuItem>

  </>;
}