import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { IconButton, ListDivider, ListItemDecorator, Menu, MenuItem, Sheet, Stack, Switch, useColorScheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import ClearIcon from '@mui/icons-material/Clear';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SwapVertIcon from '@mui/icons-material/SwapVert';

import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { ConfirmationModal } from '@/components/dialogs/ConfirmationModal';
import { PagesMenu } from '@/components/Pages';
import { StyledDropdown } from '@/components/util/StyledDropdown';
import { useChatStore } from '@/lib/store-chats';
import { useSettingsStore } from '@/lib/store-settings';


/**
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar(props: {
  conversationId: string | null;
  onDownloadConversationJSON: (conversationId: string) => void;
  onPublishConversation: (conversationId: string) => void;
  onShowSettings: () => void;
  sx?: SxProps
}) {
  // state
  const [clearConfirmationId, setClearConfirmationId] = React.useState<string | null>(null);
  const [pagesMenuAnchor, setPagesMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [actionsMenuAnchor, setActionsMenuAnchor] = React.useState<HTMLElement | null>(null);


  // settings

  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const { freeScroll, setFreeScroll, showSystemMessages, setShowSystemMessages } = useSettingsStore(state => ({
    freeScroll: state.freeScroll, setFreeScroll: state.setFreeScroll,
    showSystemMessages: state.showSystemMessages, setShowSystemMessages: state.setShowSystemMessages,
  }), shallow);

  const closePagesMenu = () => setPagesMenuAnchor(null);

  const closeActionsMenu = () => setActionsMenuAnchor(null);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleScrollModeToggle = () => setFreeScroll(!freeScroll);

  const handleSystemMessagesToggle = () => setShowSystemMessages(!showSystemMessages);

  const handleActionShowSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onShowSettings();
    closeActionsMenu();
  };


  // conversation actions

  const { isEmpty, chatModelId, systemPurposeId, setMessages, setChatModelId, setSystemPurposeId } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      isEmpty: conversation ? !conversation.messages.length : true,
      chatModelId: conversation ? conversation.chatModelId : null,
      systemPurposeId: conversation ? conversation.systemPurposeId : null,
      setMessages: state.setMessages,
      setChatModelId: state.setChatModelId,
      setSystemPurposeId: state.setSystemPurposeId,
    };
  }, shallow);

  const handleConversationClear = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setClearConfirmationId(props.conversationId);
  };

  const handleConfirmedClearConversation = () => {
    if (clearConfirmationId) {
      setMessages(clearConfirmationId, []);
      setClearConfirmationId(null);
    }
  };

  const handleConversationPublish = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.conversationId && props.onPublishConversation(props.conversationId);
  };

  const handleConversationDownload = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.conversationId && props.onDownloadConversationJSON(props.conversationId);
  };

  const handleChatModelChange = (event: any, value: ChatModelId | null) =>
    value && props.conversationId && setChatModelId(props.conversationId, value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) =>
    value && props.conversationId && setSystemPurposeId(props.conversationId, value);


  return <>

    {/* Top Bar with 2 icons and Model/Purpose selectors */}
    <Sheet
      variant='solid' color='neutral' invertedColors
      sx={{
        p: 1,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        ...(props.sx || {}),
      }}>

      <IconButton variant='plain' onClick={event => setPagesMenuAnchor(event.currentTarget)}>
        <MenuIcon />
      </IconButton>

      <Stack direction='row' sx={{ my: 'auto' }}>

        {chatModelId && <StyledDropdown items={ChatModels} value={chatModelId} onChange={handleChatModelChange} />}

        {systemPurposeId && <StyledDropdown items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />}

      </Stack>

      <IconButton variant='plain' onClick={event => setActionsMenuAnchor(event.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
    </Sheet>


    {/* Left menu */}
    {<PagesMenu pagesMenuAnchor={pagesMenuAnchor} onClose={closePagesMenu} />}


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

      <MenuItem disabled={!props.conversationId || isEmpty} onClick={handleConversationDownload}>
        <ListItemDecorator>
          {/*<Badge size='sm' color='danger'>*/}
          <FileDownloadIcon />
          {/*</Badge>*/}
        </ListItemDecorator>
        Download JSON
      </MenuItem>

      <MenuItem disabled={!props.conversationId || isEmpty} onClick={handleConversationPublish}>
        <ListItemDecorator>
          {/*<Badge size='sm' color='primary'>*/}
          <ExitToAppIcon />
          {/*</Badge>*/}
        </ListItemDecorator>
        Share via paste.gg
      </MenuItem>

      <ListDivider />

      <MenuItem disabled={!props.conversationId || isEmpty} onClick={handleConversationClear}>
        <ListItemDecorator><ClearIcon /></ListItemDecorator>
        Clear conversation
      </MenuItem>
    </Menu>


    {/* Confirmations */}
    <ConfirmationModal
      open={!!clearConfirmationId} onClose={() => setClearConfirmationId(null)} onPositive={handleConfirmedClearConversation}
      confirmationText={'Are you sure you want to discard all the messages?'} positiveActionText={'Clear conversation'}
    />

  </>;
}