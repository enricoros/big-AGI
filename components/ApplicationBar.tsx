import * as React from 'react';

import { Box, Button, Divider, IconButton, ListDivider, ListItem, ListItemDecorator, Menu, MenuItem, Modal, ModalDialog, Option, Select, Sheet, Stack, Switch, Typography, useColorScheme, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import AddIcon from '@mui/icons-material/Add';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import LunchDiningIcon from '@mui/icons-material/LunchDining';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { Link } from '@/components/util/Link';
import { useActiveConfiguration, useChatStore, useConversationNames } from '@/lib/store-chats';
import { useSettingsStore } from '@/lib/store';


/**
 * A Select component that blends-in nicely (cleaner, easier to the eyes)
 */
function NicerSelector<TValue extends string>(props: { value: TValue, items: Record<string, { title: string }>, onChange: (event: any, value: TValue | null) => void, sx?: SxProps }) {
  const theme = useTheme();
  return (
    <Select
      variant='solid' color='neutral' size='md'
      value={props.value} onChange={props.onChange}
      indicator={<KeyboardArrowDown />}
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
 * A confirmation dialog - pass the question and the positive answer, and get called when it's time to close the dialog, or when the positive action is taken
 */
function ConfirmationDialog(props: { open: boolean, onClose: () => void, onPositive: () => void, confirmationText: string, positiveActionText: string }) {
  return (
    <Modal open={props.open} onClose={props.onClose}>
      <ModalDialog variant='outlined' color='neutral'>
        <Typography component='h2' startDecorator={<WarningRoundedIcon />}>
          Confirmation
        </Typography>
        <Divider sx={{ my: 2 }} />
        <Typography>
          {props.confirmationText}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 2 }}>
          <Button variant='plain' color='neutral' onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant='solid' color='danger' onClick={props.onPositive}>
            {props.positiveActionText}
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
}


/**
 * FIXME - TEMPORARY - placeholder for a proper Pages Drawer
 */
function PagesMenu(props: { pagesMenuAnchor: HTMLElement | null, onClose: () => void }) {
  const conversationNames: { id: string; name: string, systemPurposeId: SystemPurposeId }[] = useConversationNames();
  const setActiveConversation = useChatStore((state) => state.setActiveConversationId);

  const handleConversationClicked = (conversationId: string) =>
    setActiveConversation(conversationId);

  return <Menu
    variant='plain' color='neutral' size='lg' placement='bottom-start' sx={{ minWidth: 260 }}
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
        <ListItemDecorator>{SystemPurposes[conversation.systemPurposeId]?.symbol || ''}</ListItemDecorator>
        <Typography>
          {conversation.name}
        </Typography>
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
export function ApplicationBar(props: { onClearConversation: () => void, onShowSettings: () => void, sx?: SxProps }) {
  // state
  const [pagesMenuAnchor, setPagesMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [actionsMenuAnchor, setActionsMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [clearConfirmationOpen, setClearConfirmationOpen] = React.useState(false);

  // external state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();
  const { wideMode, setWideMode, freeScroll, setFreeScroll } = useSettingsStore();
  const { chatModelId, setChatModelId, setSystemPurposeId, systemPurposeId } = useActiveConfiguration();


  const handleChatModelChange = (event: any, value: ChatModelId | null) => value && setChatModelId(value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) => value && setSystemPurposeId(value);


  const closePagesMenu = () => setPagesMenuAnchor(null);


  const closeActionsMenu = () => setActionsMenuAnchor(null);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleWideModeToggle = () => setWideMode(!wideMode);

  const handleScrollModeToggle = () => setFreeScroll(!freeScroll);

  const handleActionShowSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    props.onShowSettings();
    closeActionsMenu();
  };

  const handleActionClearConversation = (e: React.MouseEvent) => {
    e.preventDefault();
    setClearConfirmationOpen(true);
  };

  const handleConfirmedClearConversation = () => {
    closeActionsMenu();
    setClearConfirmationOpen(false);
    props.onClearConversation();
  };


  return <>
    {/* Top Bar with 2 icons and Model/Purpose selectors */}
    <Sheet
      variant='solid' invertedColors
      sx={{
        p: 1,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        ...(props.sx || {}),
      }}>

      <IconButton variant='plain' onClick={event => setPagesMenuAnchor(event.currentTarget)}>
        <LunchDiningIcon />
      </IconButton>

      <Stack direction='row' sx={{ my: 'auto' }}>

        <NicerSelector items={ChatModels} value={chatModelId} onChange={handleChatModelChange} />

        <NicerSelector items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />

      </Stack>

      <IconButton variant='plain' onClick={event => setActionsMenuAnchor(event.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
    </Sheet>

    {/* First Menu */}
    {!!pagesMenuAnchor && <PagesMenu pagesMenuAnchor={pagesMenuAnchor} onClose={closePagesMenu} />}

    {/* Second Menu */}
    <Menu
      variant='plain' color='neutral' size='lg' placement='bottom-end' sx={{ minWidth: 260 }}
      open={!!actionsMenuAnchor} anchorEl={actionsMenuAnchor} onClose={closeActionsMenu}
      disablePortal={false}>

      <MenuItem>
        <ListItemDecorator><DarkModeIcon /></ListItemDecorator>
        Dark mode
        <Switch checked={colorMode === 'dark'} onChange={handleDarkModeToggle} sx={{ ml: 'auto' }} />
      </MenuItem>

      <MenuItem sx={{ display: { xs: 'none', md: 'flex' } }}>
        <ListItemDecorator><WidthWideIcon /></ListItemDecorator>
        Wide mode
        <Switch checked={wideMode} onChange={handleWideModeToggle} sx={{ ml: 'auto' }} />
      </MenuItem>

      <MenuItem sx={{ display: { xs: 'none', md: 'flex' } }}>
        <ListItemDecorator><SwapVertIcon /></ListItemDecorator>
        Free scroll
        <Switch checked={freeScroll} onChange={handleScrollModeToggle} sx={{ ml: 'auto' }} />
      </MenuItem>

      <MenuItem onClick={handleActionShowSettings}>
        <ListItemDecorator><SettingsOutlinedIcon /></ListItemDecorator>
        Settings
      </MenuItem>

      <ListDivider />

      <MenuItem onClick={handleActionClearConversation}>
        <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
        Clear conversation
      </MenuItem>
    </Menu>

    {/* Confirmation Dialog */}
    <ConfirmationDialog
      open={clearConfirmationOpen} onClose={() => setClearConfirmationOpen(false)} onPositive={handleConfirmedClearConversation}
      confirmationText={'Are you sure you want to discard all the messages?'} positiveActionText={'Clear conversation'} />

  </>;
}