import * as React from 'react';

import { Box, Button, Divider, IconButton, ListDivider, ListItemDecorator, Menu, MenuItem, Modal, ModalDialog, Option, Select, Sheet, Stack, Switch, Typography, useColorScheme, useTheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import WidthWideIcon from '@mui/icons-material/WidthWide';

import { ChatModelId, ChatModels, SystemPurposeId, SystemPurposes } from '@/lib/data';
import { useActiveConfiguration } from '@/lib/store-chats';
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
        <Typography component='h2' startDecorator={<WarningRoundedIcon />} sx={{ mb: 1 }}>
          Confirmation
        </Typography>
        <Divider />
        <Typography level='body1' sx={{ mt: 1 }}>
          {props.confirmationText}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', pt: 2 }}>
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
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar(props: { onClearConversation: () => void, onShowSettings: () => void, sx?: SxProps }) {
  // state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();
  const { wideMode, setWideMode } = useSettingsStore();
  const { chatModelId, setChatModelId, setSystemPurposeId, systemPurposeId } = useActiveConfiguration();
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [clearConfirmationOpen, setClearConfirmationOpen] = React.useState(false);


  const handleChatModelChange = (event: any, value: ChatModelId | null) => value && setChatModelId(value);

  const handleSystemPurposeChange = (event: any, value: SystemPurposeId | null) => value && setSystemPurposeId(value);


  const closeMenu = () => setMenuAnchor(null);

  const handleDarkModeToggle = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleWideModeToggle = () => setWideMode(!wideMode);

  const handleMenuShowSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    props.onShowSettings();
    closeMenu();
  };

  const handleMenuClearConversation = (e: React.MouseEvent) => {
    e.preventDefault();
    setClearConfirmationOpen(true);
  };

  const handleConfirmedClearConversation = () => {
    closeMenu();
    setClearConfirmationOpen(false);
    props.onClearConversation();
  };


  return (
    <Sheet
      variant='solid' invertedColors
      sx={{
        p: 1,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        ...(props.sx || {}),
      }}>

      <IconButton variant='plain' onClick={handleDarkModeToggle}>
        <DarkModeIcon />
      </IconButton>

      <Stack direction='row' sx={{ my: 'auto' }}>

        <NicerSelector items={ChatModels} value={chatModelId} onChange={handleChatModelChange} />

        <NicerSelector items={SystemPurposes} value={systemPurposeId} onChange={handleSystemPurposeChange} />

      </Stack>

      <IconButton variant='plain' onClick={event => setMenuAnchor(event.currentTarget)}>
        <MoreVertIcon />
      </IconButton>


      <Menu
        variant='plain' color='neutral' size='lg' placement='bottom-end' sx={{ minWidth: 260 }}
        open={!!menuAnchor} anchorEl={menuAnchor} onClose={closeMenu}
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

        <MenuItem onClick={handleMenuShowSettings}>
          <ListItemDecorator><SettingsOutlinedIcon /></ListItemDecorator>
          Settings
        </MenuItem>

        <ListDivider />

        <MenuItem onClick={handleMenuClearConversation}>
          <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
          Clear conversation
        </MenuItem>
      </Menu>

      <ConfirmationDialog
        open={clearConfirmationOpen} onClose={() => setClearConfirmationOpen(false)} onPositive={handleConfirmedClearConversation}
        confirmationText={'Are you sure you want to discard all the messages?'} positiveActionText={'Clear conversation'} />

    </Sheet>
  );
}