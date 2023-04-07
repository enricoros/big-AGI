import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { IconButton, ListDivider, ListItemDecorator, Menu, MenuItem, Sheet, Stack, Switch, useColorScheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SwapVertIcon from '@mui/icons-material/SwapVert';

import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { PagesMenu } from '@/components/Pages';
import { StyledDropdown } from '@/components/util/StyledDropdown';
import { useActiveConfiguration } from '@/lib/store-chats';
import { useSettingsStore } from '@/lib/store-settings';


/**
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar({ onClearConversation, onDownloadConversationJSON, onPublishConversation, onShowSettings, sx }: {
  onClearConversation: (conversationId: (string | null)) => void;
  onDownloadConversationJSON: (conversationId: (string | null)) => void;
  onPublishConversation: (conversationId: (string | null)) => void;
  onShowSettings: () => void;
  sx?: SxProps
}) {
  // state
  const [pagesMenuAnchor, setPagesMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [actionsMenuAnchor, setActionsMenuAnchor] = React.useState<HTMLElement | null>(null);

  // external state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();
  const { freeScroll, setFreeScroll, showSystemMessages, setShowSystemMessages } = useSettingsStore(state => ({
    freeScroll: state.freeScroll, setFreeScroll: state.setFreeScroll,
    showSystemMessages: state.showSystemMessages, setShowSystemMessages: state.setShowSystemMessages,
  }), shallow);
  const { chatModelId, setChatModelId, setSystemPurposeId, systemPurposeId } = useActiveConfiguration();


  const handleChatModelChange = (event: any, value: ChatModelId | null) => value && setChatModelId(value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) => value && setSystemPurposeId(value);


  const closePagesMenu = () => setPagesMenuAnchor(null);


  const closeActionsMenu = () => setActionsMenuAnchor(null);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleScrollModeToggle = () => setFreeScroll(!freeScroll);

  const handleSystemMessagesToggle = () => setShowSystemMessages(!showSystemMessages);

  const handleActionShowSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowSettings();
    closeActionsMenu();
  };

  const handleActionDownloadChatJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDownloadConversationJSON(null);
  };

  const handleActionPublishChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPublishConversation(null);
  };

  const handleActionClearConversation = (e: React.MouseEvent, id: string | null) => {
    e.stopPropagation();
    onClearConversation(id || null);
  };


  return <>

    {/* Top Bar with 2 icons and Model/Purpose selectors */}
    <Sheet
      variant='solid' color='neutral' invertedColors
      sx={{
        p: 1,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        ...(sx || {}),
      }}>

      <IconButton variant='plain' onClick={event => setPagesMenuAnchor(event.currentTarget)}>
        <MenuIcon />
      </IconButton>

      <Stack direction='row' sx={{ my: 'auto' }}>

        <StyledDropdown items={ChatModels} value={chatModelId} onChange={handleChatModelChange} />

        <StyledDropdown items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />

      </Stack>

      <IconButton variant='plain' onClick={event => setActionsMenuAnchor(event.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
    </Sheet>


    {/* Left menu */}
    {<PagesMenu
      pagesMenuAnchor={pagesMenuAnchor}
      onClose={closePagesMenu}
      onClearConversation={handleActionClearConversation}
    />}


    {/* Right menu */}
    <Menu
      variant='plain' color='neutral' size='lg' placement='bottom-end' sx={{ minWidth: 280 }}
      open={!!actionsMenuAnchor} anchorEl={actionsMenuAnchor} onClose={closeActionsMenu}
      disablePortal={false}>

      <MenuItem>
        <ListItemDecorator><DarkModeIcon /></ListItemDecorator>
        Dark
        <Switch checked={colorMode === 'dark'} onChange={handleDarkModeToggle} sx={{ ml: 'auto' }} />
      </MenuItem>

      <MenuItem>
        <ListItemDecorator><SettingsSuggestIcon /></ListItemDecorator>
        System text
        <Switch checked={showSystemMessages} onChange={handleSystemMessagesToggle} sx={{ ml: 'auto' }} />
      </MenuItem>

      <MenuItem>
        <ListItemDecorator><SwapVertIcon /></ListItemDecorator>
        Free scroll
        <Switch checked={freeScroll} onChange={handleScrollModeToggle} sx={{ ml: 'auto' }} />
      </MenuItem>

      <MenuItem onClick={handleActionShowSettings}>
        <ListItemDecorator><SettingsOutlinedIcon /></ListItemDecorator>
        Settings
      </MenuItem>

      <ListDivider />

      <MenuItem onClick={handleActionDownloadChatJson}>
        <ListItemDecorator>
          {/*<Badge size='sm' color='danger'>*/}
          <FileDownloadIcon />
          {/*</Badge>*/}
        </ListItemDecorator>
        Download JSON
      </MenuItem>

      <MenuItem onClick={handleActionPublishChat}>
        <ListItemDecorator>
          {/*<Badge size='sm' color='primary'>*/}
          <ExitToAppIcon />
          {/*</Badge>*/}
        </ListItemDecorator>
        Share via paste.gg
      </MenuItem>

      <ListDivider />

      <MenuItem onClick={e => handleActionClearConversation(e, null)}>
        <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
        Clear conversation
      </MenuItem>
    </Menu>

  </>;
}