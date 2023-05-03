import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Badge, Box, Button, IconButton, ListDivider, ListItem, ListItemDecorator, Menu, MenuItem, Sheet, Stack, SvgIcon, Switch, useColorScheme, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import CheckBoxOutlineBlankOutlinedIcon from '@mui/icons-material/CheckBoxOutlineBlankOutlined';
import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import ClearIcon from '@mui/icons-material/Clear';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import GitHubIcon from '@mui/icons-material/GitHub';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';

import { Brand } from '@/common/brand';
import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '../../../../data';
import { ConfirmationModal } from '@/common/components/ConfirmationModal';
import { Link } from '@/common/components/Link';
import { cssRainbowColorKeyframes } from '@/common/theme';
import { downloadConversationJson, restoreConversationFromJson, useChatStore } from '@/common/state/store-chats';
import { useSettingsStore } from '@/common/state/store-settings';

import { AppBarDropdown } from './AppBarDropdown';
import { AppBarDropdownWithSymbol } from './AppBarDropdownWithSymbol';
import { ImportedModal, ImportedOutcome } from './ImportedModal';
import { PagesMenu } from './PagesMenu';


// missing from MUI, using Tabler for Discord
function DiscordIcon(props: { sx?: SxProps }) {
  return <SvgIcon viewBox='0 0 24 24' width='24' height='24' stroke='currentColor' fill='none' strokeLinecap='round' strokeLinejoin='round' {...props}>
    <path stroke='none' d='M0 0h24v24H0z' fill='none'></path>
    <path d='M14.983 3l.123 .006c2.014 .214 3.527 .672 4.966 1.673a1 1 0 0 1 .371 .488c1.876 5.315 2.373 9.987 1.451 12.28c-1.003 2.005 -2.606 3.553 -4.394 3.553c-.94 0 -2.257 -1.596 -2.777 -2.969l-.02 .005c.838 -.131 1.69 -.323 2.572 -.574a1 1 0 1 0 -.55 -1.924c-3.32 .95 -6.13 .95 -9.45 0a1 1 0 0 0 -.55 1.924c.725 .207 1.431 .373 2.126 .499l.444 .074c-.477 1.37 -1.695 2.965 -2.627 2.965c-1.743 0 -3.276 -1.555 -4.267 -3.644c-.841 -2.206 -.369 -6.868 1.414 -12.174a1 1 0 0 1 .358 -.49c1.392 -1.016 2.807 -1.475 4.717 -1.685a1 1 0 0 1 .938 .435l.063 .107l.652 1.288l.16 -.019c.877 -.09 1.718 -.09 2.595 0l.158 .019l.65 -1.287a1 1 0 0 1 .754 -.54l.123 -.01zm-5.983 6a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15zm6 0a2 2 0 0 0 -1.977 1.697l-.018 .154l-.005 .149l.005 .15a2 2 0 1 0 1.995 -2.15z' strokeWidth='0' fill='currentColor'></path>
  </SvgIcon>;
}

function BringTheLove(props: { text: string, link: string, icon: JSX.Element }) {
  const [loved, setLoved] = React.useState(false);
  const icon = loved ? '❤️' : props.icon; // '❤️' : '🤍';
  return <Button
    color='neutral'
    component={Link} noLinkStyle href={props.link} target='_blank'
    onClick={() => setLoved(true)}
    endDecorator={icon}
    sx={{
      background: 'transparent',
      // '&:hover': { background: props.theme.palette.neutral.solidBg },
      '&:hover': { animation: `${cssRainbowColorKeyframes} 5s linear infinite` },
    }}>
    {props.text}
  </Button>;
}

function SupportItem() {
  const theme = useTheme();
  const fadedColor = theme.palette.neutral.plainDisabledColor;
  const iconColor = '';
  return (
    <ListItem
      variant='solid' color='neutral'
      sx={{
        mb: -1, // absorb the bottom margin of the list
        mt: 1,
        // background: theme.palette.neutral.solidActiveBg,
        display: 'flex', flexDirection: 'row', gap: 1,
        justifyContent: 'space-between',
      }}>
      <Box
        sx={{
          mx: { xs: 1, sm: 2 },
          fontWeight: 600,
          color: fadedColor,
        }}>
        {Brand.Meta.SiteName}
      </Box>
      <BringTheLove text='Discord' icon={<DiscordIcon sx={{ color: iconColor }} />} link={Brand.URIs.SupportInvite} />
      <BringTheLove text='GitHub' icon={<GitHubIcon sx={{ color: iconColor }} />} link={Brand.URIs.OpenRepo} />
    </ListItem>
  );
}


/**
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar(props: {
  conversationId: string | null;
  isMessageSelectionMode: boolean; setIsMessageSelectionMode: (isMessageSelectionMode: boolean) => void;
  onPublishConversation: (conversationId: string) => void;
  onShowSettings: () => void;
  sx?: SxProps
}) {

  // state
  const [actionsMenuAnchor, setActionsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [pagesMenuAnchor, setPagesMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [clearConfirmationId, setClearConfirmationId] = React.useState<string | null>(null);
  const [conversationImportOutcome, setConversationImportOutcome] = React.useState<ImportedOutcome | null>(null);
  const conversationFileInputRef = React.useRef<HTMLInputElement>(null);


  // center buttons

  const handleChatModelChange = (event: any, value: ChatModelId | null) =>
    value && props.conversationId && setChatModelId(props.conversationId, value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) =>
    value && props.conversationId && setSystemPurposeId(props.conversationId, value);


  // quick actions

  const closeActionsMenu = () => setActionsMenuAnchor(null);

  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const { showSystemMessages, setShowSystemMessages, zenMode } = useSettingsStore(state => ({
    showSystemMessages: state.showSystemMessages, setShowSystemMessages: state.setShowSystemMessages,
    zenMode: state.zenMode,
  }), shallow);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleSystemMessagesToggle = () => setShowSystemMessages(!showSystemMessages);

  const handleActionShowSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onShowSettings();
    closeActionsMenu();
  };

  // conversation actions

  const { conversationsCount, isConversationEmpty, chatModelId, systemPurposeId, setMessages, setChatModelId, setSystemPurposeId, setAutoTitle, importConversation } = useChatStore(state => {
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
      importConversation: state.importConversation,
    };
  }, shallow);

  const handleConversationPublish = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.conversationId && props.onPublishConversation(props.conversationId);
  };

  const handleConversationDownload = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const conversation = useChatStore.getState().conversations.find(conversation => conversation.id === props.conversationId);
    if (conversation)
      downloadConversationJson(conversation);
  };

  const handleToggleMessageSelectionMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeActionsMenu();
    props.setIsMessageSelectionMode(!props.isMessageSelectionMode);
  };

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


  // pages actions

  const closePagesMenu = () => setPagesMenuAnchor(null);

  const handleConversationUpload = () => conversationFileInputRef.current?.click();

  const handleLoadConversations = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target?.files;
    if (!files || files.length < 1)
      return;

    // try to restore conversations from the selected files
    const outcomes: ImportedOutcome = { conversations: [] };
    for (const file of files) {
      const fileName = file.name || 'unknown file';
      try {
        const conversation = restoreConversationFromJson(await file.text());
        if (conversation) {
          importConversation(conversation);
          outcomes.conversations.push({ fileName, success: true, conversationId: conversation.id });
        } else {
          const fileDesc = `(${file.type}) ${file.size.toLocaleString()} bytes`;
          outcomes.conversations.push({ fileName, success: false, error: `Invalid file: ${fileDesc}` });
        }
      } catch (error) {
        console.error(error);
        outcomes.conversations.push({ fileName, success: false, error: (error as any)?.message || error?.toString() || 'unknown error' });
      }
    }

    // show the outcome of the import
    setConversationImportOutcome(outcomes);

    // this is needed to allow the same file to be selected again
    e.target.value = '';
  };


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


    {/* Left menu content */}
    <PagesMenu
      conversationId={props.conversationId}
      pagesMenuAnchor={pagesMenuAnchor}
      onClose={closePagesMenu}
      onImportConversation={handleConversationUpload}
    />

    {/* Right menu content */}
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

      <MenuItem disabled={!props.conversationId || isConversationEmpty} onClick={handleConversationPublish}>
        <ListItemDecorator>
          {/*<Badge size='sm' color='primary'>*/}
          <ExitToAppIcon />
          {/*</Badge>*/}
        </ListItemDecorator>
        Share via paste.gg
      </MenuItem>

      <MenuItem disabled={!props.conversationId || isConversationEmpty} onClick={handleConversationDownload}>
        <ListItemDecorator>
          <FileDownloadIcon />
        </ListItemDecorator>
        Export conversation
      </MenuItem>

      <ListDivider />

      <MenuItem disabled={!props.conversationId || isConversationEmpty} onClick={handleToggleMessageSelectionMode}>
        <ListItemDecorator>{props.isMessageSelectionMode ? <CheckBoxOutlinedIcon /> : <CheckBoxOutlineBlankOutlinedIcon />}</ListItemDecorator>
        Cleanup ...
      </MenuItem>

      <MenuItem disabled={!props.conversationId || isConversationEmpty} onClick={handleConversationClear}>
        <ListItemDecorator><ClearIcon /></ListItemDecorator>
        Clear conversation
      </MenuItem>

      <SupportItem />
    </Menu>


    {/* Modals */}
    <ConfirmationModal
      open={!!clearConfirmationId} onClose={() => setClearConfirmationId(null)} onPositive={handleConfirmedClearConversation}
      confirmationText={'Are you sure you want to discard all the messages?'} positiveActionText={'Clear conversation'}
    />

    {!!conversationImportOutcome && (
      <ImportedModal open outcome={conversationImportOutcome} onClose={() => setConversationImportOutcome(null)} />
    )}

    {/* Files */}
    <input type='file' multiple hidden accept='.json' ref={conversationFileInputRef} onChange={handleLoadConversations} />

  </>;
}