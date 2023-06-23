import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Badge, Box, IconButton, ListDivider, ListItemDecorator, Menu, MenuItem, Sheet, Switch, useColorScheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { useUIStateStore } from '~/common/state/store-ui';

import { SupportMenuItem } from './SupportMenuItem';
import { useApplicationBarStore } from './store-applicationbar';


function CommonContextItems(props: { onClose: () => void }) {
  // external state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const handleToggleDarkMode = () => setColorMode(colorMode === 'dark' ? 'light' : 'dark');

  const handleShowSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    useUIStateStore.getState().openSettings();
    props.onClose();
  };

  return <>

    <MenuItem onClick={handleToggleDarkMode}>
      <ListItemDecorator><DarkModeIcon /></ListItemDecorator>
      Dark
      <Switch checked={colorMode === 'dark'} onChange={handleToggleDarkMode} sx={{ ml: 'auto' }} />
    </MenuItem>

    <MenuItem onClick={handleShowSettings}>
      <ListItemDecorator><SettingsOutlinedIcon /></ListItemDecorator>
      Preferences
    </MenuItem>

  </>;
}


/**
 * The top bar of the application, with the model and purpose selection, and menu/settings icons
 */
export function ApplicationBar(props: { sx?: SxProps }) {

  // external state
  const {
    centerItems, appMenuBadge, appMenuItems, contextMenuItems,
    appMenuAnchor: applicationMenuAnchor, setAppMenuAnchor: setApplicationMenuAnchor,
    contextMenuAnchor, setContextMenuAnchor,
  } = useApplicationBarStore(state => ({
    appMenuBadge: state.appMenuBadge,
    appMenuItems: state.appMenuItems,
    centerItems: state.centerItems,
    contextMenuItems: state.contextMenuItems,
    appMenuAnchor: state.appMenuAnchor, setAppMenuAnchor: state.setAppMenuAnchor,
    contextMenuAnchor: state.contextMenuAnchor, setContextMenuAnchor: state.setContextMenuAnchor,
  }), shallow);

  const closeApplicationMenu = () => setApplicationMenuAnchor(null);

  const closeContextMenu = React.useCallback(() => setContextMenuAnchor(null), [setContextMenuAnchor]);

  const commonContextItems = React.useMemo(() =>
      <CommonContextItems onClose={closeContextMenu} />
    , [closeContextMenu]);

  return <>

    <Sheet
      variant='solid' color='neutral' invertedColors
      sx={{
        p: 1,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between',
        ...(props.sx || {}),
      }}>

      {/* Application-Menu Button */}
      <IconButton disabled={!!applicationMenuAnchor || !appMenuItems} variant='plain' onClick={event => setApplicationMenuAnchor(event.currentTarget)}>
        <Badge variant='solid' size='sm' badgeContent={appMenuBadge ? appMenuBadge : 0}>
          <MenuIcon />
        </Badge>
      </IconButton>

      {centerItems && <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', my: 'auto' }}>
        {centerItems}
      </Box>}

      {/* Context-Menu Button */}
      <IconButton disabled={!!contextMenuAnchor || !contextMenuItems} variant='plain' onClick={event => setContextMenuAnchor(event.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
    </Sheet>


    {/* Application-Menu Items */}
    {!!appMenuItems && <Menu
      variant='plain' color='neutral' size='lg' sx={{ minWidth: 320, maxHeight: 'calc(100dvh - 56px)', overflowY: 'auto' }}
      open={!!applicationMenuAnchor} anchorEl={applicationMenuAnchor} onClose={closeApplicationMenu}
      placement='bottom-start' disablePortal={false}
    >
      {appMenuItems}
    </Menu>}

    {/* Context-Menu Items */}
    <Menu
      variant='plain' color='neutral' size='lg' sx={{ minWidth: 280, maxHeight: 'calc(100dvh - 56px)', overflowY: 'auto' }}
      open={!!contextMenuAnchor} anchorEl={contextMenuAnchor} onClose={closeContextMenu}
      placement='bottom-end' disablePortal={false}
    >
      {commonContextItems}
      <ListDivider />
      {contextMenuItems}
      <SupportMenuItem />
    </Menu>

  </>;
}