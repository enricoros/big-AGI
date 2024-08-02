import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { ListDivider, ListItemDecorator, MenuItem, Switch, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { SettingUIComplexity } from '../settings-modal/settings-ui/SettingUIComplexity';
import { SettingUIContentScaling } from '../settings-modal/settings-ui/SettingUIContentScaling';

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
  const { renderMarkdown, setRenderMarkdown } = useUIPreferencesStore(useShallow(state => ({
    renderMarkdown: state.renderMarkdown, setRenderMarkdown: state.setRenderMarkdown,
  })));


  const handleRenderSystemMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowSystemMessages(event.target.checked);

  const handleRenderMarkdownChange = (event: React.ChangeEvent<HTMLInputElement>) => setRenderMarkdown(event.target.checked);

  const { activeLinkId, onDeleteLink } = props;

  const handleDeleteLink = React.useCallback(() => {
    activeLinkId && onDeleteLink(activeLinkId);
  }, [activeLinkId, onDeleteLink]);


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

    <SettingUIComplexity noLabel />

    <SettingUIContentScaling noLabel />

    <ListDivider />

    <MenuItem onClick={handleDeleteLink} sx={{ justifyContent: 'space-between' }}>
      Delete
      <ListItemDecorator>
        <DeleteOutlineIcon />
      </ListItemDecorator>
    </MenuItem>

  </>;
}