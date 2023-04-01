import * as React from 'react';

import { Badge, IconButton, ListDivider, ListItem, ListItemDecorator, Menu, MenuItem, Option, Select, Sheet, Stack, Switch, Typography, useColorScheme, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import AddIcon from '@mui/icons-material/Add';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LunchDiningIcon from '@mui/icons-material/LunchDining';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import WidthFullIcon from '@mui/icons-material/WidthFull';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { Link } from '@/components/util/Link';
import { foolsMode } from '@/lib/theme';
import { useActiveConfiguration, useChatStore, useConversationNames } from '@/lib/store-chats';
import { useSettingsStore } from '@/lib/store';


/**
 * A Select component that blends-in nicely (cleaner, easier to the eyes)
 */
function BeautifulSelect<TValue extends string>(props: { value: TValue, items: Record<string, { title: string }>, onChange: (event: any, value: TValue | null) => void, sx?: SxProps }) {
  const theme = useTheme();
  return (
    <Select
      variant='solid' color='neutral' size='md'
      value={props.value} onChange={props.onChange}
      indicator={<KeyboardArrowDownIcon />}
      slotProps={{
        listbox: {
          variant: 'plain', color: 'neutral',
          disablePortal: false,
        },
        indicator: {
          sx: {
            opacity: 0.5,
          },
        },
      }}
      sx={{
        mx: 0,
        fontFamily: theme.vars.fontFamily.code,
        ...(props.sx || {}),
      }}
    >
      {Object.keys(props.items).map((key: string) => (
        <Option key={key} value={key}>
          {props.items[key].title}
        </Option>
      ))}
    </Select>
  );
}

/**
 * FIXME - TEMPORARY - placeholder for a proper Pages Drawer
 */
function PagesMenu(props: { pagesMenuAnchor: HTMLElement | null, onClose: () => void, onClearConversation: (e: React.MouseEvent, conversationId: string) => void }) {

  // external state
  const setActiveConversation = useChatStore(state => state.setActiveConversationId);
  const conversationNames: { id: string; name: string, systemPurposeId: SystemPurposeId }[] = useConversationNames();

  const handleConversationClicked = (conversationId: string) => setActiveConversation(conversationId);

  return <Menu
    variant='plain' color='neutral' size='lg' placement='bottom-start' sx={{ minWidth: 280 }}
    open={!!props.pagesMenuAnchor} anchorEl={props.pagesMenuAnchor} onClose={props.onClose}
    disablePortal={false}>

    <ListItem>
      <Typography level='body2'>
        Active chats
      </Typography>
    </ListItem>

    {conversationNames.map((conversation) => (
      <MenuItem
        key={'c-id-' + conversation.id}
        onClick={() => handleConversationClicked(conversation.id)}
      >

        <ListItemDecorator>
          {SystemPurposes[conversation.systemPurposeId]?.symbol || ''}
        </ListItemDecorator>

        <Typography sx={{ mr: 2 }}>
          {conversation.name}
        </Typography>

        <IconButton
          variant='soft' color='neutral' sx={{ ml: 'auto' }}
          onClick={e => props.onClearConversation(e, conversation.id)}>
          <DeleteOutlineIcon />
        </IconButton>

      </MenuItem>
    ))}

    <MenuItem disabled={true}>
      <ListItemDecorator><AddIcon /></ListItemDecorator>
      <Typography sx={{ opacity: 0.5 }}>
        New chat (soon)
        {/* We need stable Chat and Message IDs, and one final review to the data structure of Conversation for future-proofing */}
      </Typography>
    </MenuItem>


    <ListItem>
      <Typography level='body2'>
        Scratchpad
      </Typography>
    </ListItem>

    <MenuItem>
      <ListItemDecorator />
      <Typography sx={{ opacity: 0.5 }}>
        Feature <Link href='https://github.com/enricoros/nextjs-chatgpt-app/issues/17' target='_blank'>#17</Link>
      </Typography>
    </MenuItem>

  </Menu>;
}


/**
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar({ onClearConversation, onExportConversation, onShowSettings, sx }: {
  onClearConversation: (conversationId: (string | null)) => void;
  onExportConversation: (conversationId: (string | null)) => void;
  onShowSettings: () => void;
  sx?: SxProps
}) {
  // state
  const [pagesMenuAnchor, setPagesMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [actionsMenuAnchor, setActionsMenuAnchor] = React.useState<HTMLElement | null>(null);

  // external state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();
  const { freeScroll, setFreeScroll, setShowSystemMessages, setWideMode, showSystemMessages, wideMode } = useSettingsStore();
  const { chatModelId, setChatModelId, setSystemPurposeId, systemPurposeId } = useActiveConfiguration();


  const handleChatModelChange = (event: any, value: ChatModelId | null) => value && setChatModelId(value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) => value && setSystemPurposeId(value);


  const closePagesMenu = () => setPagesMenuAnchor(null);


  const closeActionsMenu = () => setActionsMenuAnchor(null);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleWideModeToggle = () => setWideMode(!wideMode);

  const handleScrollModeToggle = () => setFreeScroll(!freeScroll);

  const handleSystemMessagesToggle = () => setShowSystemMessages(!showSystemMessages);

  const handleActionShowSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    onShowSettings();
    closeActionsMenu();
  };

  const handleActionExportChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExportConversation(null);
  };

  const handleActionClearConversation = (e: React.MouseEvent, id: string | null) => {
    e.stopPropagation();
    onClearConversation(id || null);
  };


  return <>

    {/* Top Bar with 2 icons and Model/Purpose selectors */}
    <Sheet
      variant='solid' invertedColors
      sx={{
        p: 1,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        ...(sx || {}),
      }}>

      <IconButton variant='plain' onClick={event => setPagesMenuAnchor(event.currentTarget)}>
        {foolsMode ? <LunchDiningIcon /> : <MenuIcon />}
      </IconButton>

      <Stack direction='row' sx={{ my: 'auto' }}>

        <BeautifulSelect items={ChatModels} value={chatModelId} onChange={handleChatModelChange} />

        <BeautifulSelect items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />

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

      <MenuItem sx={{ display: { xs: 'none', md: 'flex' } }}>
        <ListItemDecorator>{wideMode ? <WidthFullIcon /> : <WidthWideIcon />}</ListItemDecorator>
        Wide
        <Switch checked={wideMode} onChange={handleWideModeToggle} sx={{ ml: 'auto' }} />
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

      <MenuItem onClick={handleActionExportChat}>
        <ListItemDecorator>
          <Badge size='sm' badgeContent='new' color='primary'>
            <ExitToAppIcon />
          </Badge>
        </ListItemDecorator>
        Share via paste.gg
      </MenuItem>

      <MenuItem onClick={e => handleActionClearConversation(e, null)}>
        <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
        Clear conversation
      </MenuItem>
    </Menu>

  </>;
}