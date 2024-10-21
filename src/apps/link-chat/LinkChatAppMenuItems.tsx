import * as React from 'react';

import { ListDivider, ListItemDecorator, MenuItem, Switch, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { OptimaPanelGroupedList } from '~/common/layout/optima/panel/OptimaPanelGroupedList';

import { SettingUIComplexity } from '../settings-modal/settings-ui/SettingUIComplexity';
import { SettingUIContentScaling } from '../settings-modal/settings-ui/SettingUIContentScaling';

import { useChatShowSystemMessages } from '../chat/store-app-chat';


/**
 * Menu Items are the settings for the chat.
 */
export function LinkChatAppMenuItems(props: {
  activeLinkId: string | null,
  onDeleteLink: (linkId: string) => void,
}) {

  // external state
  const [showSystemMessages, setShowSystemMessages] = useChatShowSystemMessages();

  const handleRenderSystemMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => setShowSystemMessages(event.target.checked);

  const { activeLinkId, onDeleteLink } = props;

  const handleDeleteLink = React.useCallback(() => {
    activeLinkId && onDeleteLink(activeLinkId);
  }, [activeLinkId, onDeleteLink]);


  return <OptimaPanelGroupedList title='Conversation'>

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

    <SettingUIComplexity noLabel />

    <SettingUIContentScaling noLabel />

    <ListDivider />

    <MenuItem onClick={handleDeleteLink} sx={{ justifyContent: 'space-between' }}>
      Delete
      <ListItemDecorator>
        <DeleteOutlineIcon />
      </ListItemDecorator>
    </MenuItem>

  </OptimaPanelGroupedList>;
}