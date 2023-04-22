import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Badge, IconButton, ListDivider, ListItemDecorator, Menu, MenuItem, Sheet, Stack, Switch, useColorScheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CheckBoxOutlineBlankOutlinedIcon from '@mui/icons-material/CheckBoxOutlineBlankOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { AppBarDropdown } from '@/components/util/AppBarDropdown';
import { AppBarDropdownWithSymbol } from '@/components/util/AppBarDropdownWithSymbol';
import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { ConfirmationModal } from '@/components/dialogs/ConfirmationModal';
import { PagesMenu } from '@/components/Pages';
import { useChatStore } from '@/lib/stores/store-chats';
import { useSettingsStore } from '@/lib/stores/store-settings';


/**
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar(props: {
  conversationId: string | null;
  isMessageSelectionMode: boolean; setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void;
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

  const { showSystemMessages, setShowSystemMessages, zenMode } = useSettingsStore(state => ({
    showSystemMessages: state.showSystemMessages, setShowSystemMessages: state.setShowSystemMessages,
    zenMode: state.zenMode,
  }), shallow);

  const closePagesMenu = () => setPagesMenuAnchor(null);

  const closeActionsMenu = () => setActionsMenuAnchor(null);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleSystemMessagesToggle = () => setShowSystemMessages(!showSystemMessages);

  const handleActionShowSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onShowSettings();
    closeActionsMenu();
  };


  // conversation actions

  const { conversationsCount, isConversationEmpty, chatModelId, systemPurposeId, setMessages, setChatModelId, setSystemPurposeId, setAutoTitle } = useChatStore(state => {
    const conversation = state.conversations.find(conversation => conversation.id === props.conversationId);
    return {
      conversationsCount: state.conversations.length,
      isConversationEmpty: conversation ? !conversation.messages.length : true,
      chatModelId: conversation ? conversation.chatModelId : null,
      systemPurposeId: conversation ? conversation.systemPurposeId : null,
      setMessages: state.setMessages,
      setChatModelId: state.setChatModelId,
      setSystemPurposeId: state.setSystemPurposeId,
      setAutoTitle: state.setAutoTitle,
    };
  }, shallow);

  const handleConversationClear = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setClearConfirmationId(props.conversationId);
  };

  const handleConfirmedClearConversation = () => {
    if (clearConfirmationId) {
      setMessages(clearConfirmationId, []);
      setAutoTitle(clearConfirmationId, '');
      setClearConfirmationId(null);
    }
  };

  const handleConversationPublish = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.conversationId && props.onPublishConversation(props.conversationId);
  };

  const handleToggleMessageSelectionMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeActionsMenu();
    props.setIsMessageSelectionMode(!props.isMessageSelectionMode);
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
        <Badge variant='solid' size='sm' badgeContent={conversationsCount < 2 ? 0 : conversationsCount}>
          <MenuIcon />
        </Badge>
      </IconButton>

      <Stack direction='row' sx={{ my: 'auto' }}>

        {chatModelId && <AppBarDropdown items={ChatModels} value={chatModelId} onChange={handleChatModelChange} />}

        {systemPurposeId && (zenMode === 'cleaner'
            ? <AppBarDropdown items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />
            : <AppBarDropdownWithSymbol items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />
        )}

      </Stack>

      <IconButton variant='plain' onClick={event => setActionsMenuAnchor(event.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
    </Sheet>


    {/* Left menu */}
    {<PagesMenu conversationId={props.conversationId} pagesMenuAnchor={pagesMenuAnchor} onClose={closePagesMenu} />}


    {/* Right menu */}
    <Menu
      variant='plain' color='neutral' size='lg' placement='bottom-end' sx={{ minWidth: 280 }}
      open={!!actionsMenuAnchor} anchorEl={actionsMenuAnchor} onClose={closeActionsMenu}
      disablePortal={false}>

      <MenuItem onClick={handleDarkModeToggle}>
        <ListItemDecorator><DarkModeIcon /></ListItemDecorator>
        Dark
        <Switch checked={colorMode === 'dark'} onChange={handleDarkModeToggle} sx={{ ml: 'auto' }} />
      </MenuItem>

      <MenuItem onClick={handleSystemMessagesToggle}>
        <ListItemDecorator><SettingsSuggestIcon /></ListItemDecorator>
        System text
        <Switch checked={showSystemMessages} onChange={handleSystemMessagesToggle} sx={{ ml: 'auto' }} />
      </MenuItem>

      <MenuItem onClick={handleActionShowSettings}>
        <ListItemDecorator><SettingsOutlinedIcon /></ListItemDecorator>
        Settings
      </MenuItem>

      <ListDivider />

      <MenuItem disabled={!props.conversationId || isConversationEmpty} onClick={handleConversationDownload}>
        <ListItemDecorator>
          {/*<Badge size='sm' color='danger'>*/}
          <FileDownloadIcon />
          {/*</Badge>*/}
        </ListItemDecorator>
        Download JSON
      </MenuItem>

      <MenuItem disabled={!props.conversationId || isConversationEmpty} onClick={handleConversationPublish}>
        <ListItemDecorator>
          {/*<Badge size='sm' color='primary'>*/}
          <ExitToAppIcon />
          {/*</Badge>*/}
        </ListItemDecorator>
        Share via paste.gg
      </MenuItem>

      <ListDivider />

      <MenuItem disabled={!props.conversationId || isConversationEmpty} onClick={handleToggleMessageSelectionMode}>
        <ListItemDecorator>{props.isMessageSelectionMode ? <CheckBoxOutlinedIcon /> : <CheckBoxOutlineBlankOutlinedIcon />}</ListItemDecorator>
        Select messages
      </MenuItem>

      <MenuItem disabled={!props.conversationId || isConversationEmpty} onClick={handleConversationClear}>
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