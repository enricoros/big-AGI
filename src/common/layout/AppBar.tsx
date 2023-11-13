import * as React from 'react';

import { Box, IconButton, ListDivider, ListItemDecorator, MenuItem, Sheet, Typography, useColorScheme } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { Brand } from '../app.config';
import { CloseableMenu } from '../components/CloseableMenu';
import { Link } from '../components/Link';
import { LogoSquircle } from '../components/LogoSquircle';

// import { AppBarSupportItem } from './AppBarSupportItem';
import { AppBarSwitcherItem } from './AppBarSwitcherItem';
import { closeLayoutDrawer, closeLayoutMenu, openLayoutPreferences, setLayoutDrawerAnchor, setLayoutMenuAnchor, useLayoutComponents } from './store-applayout';


function AppBarTitle() {
  return (
    <Link href='/'>
      <LogoSquircle sx={{
        width: 32,
        height: 32,
        color: 'white',
        // filter: 'invert(1)',
      }} />
      <Typography sx={{
        ml: { xs: 1, md: 2 },
        color: 'white',
      }}>
        {Brand.Title.Base}
      </Typography>
    </Link>
  );
}


function CommonMenuItems(props: { onClose: () => void }) {
  // external state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const handleShowSettings = (event: React.MouseEvent) => {
    event.stopPropagation();
    openLayoutPreferences();
    props.onClose();
  };

  const handleToggleDarkMode = (event: React.MouseEvent) => {
    event.stopPropagation();
    setColorMode(colorMode === 'dark' ? 'light' : 'dark');
  };

  return <>

    {/*<MenuItem onClick={handleToggleDarkMode}>*/}
    {/*  <ListItemDecorator><DarkModeIcon /></ListItemDecorator>*/}
    {/*  Dark*/}
    {/*  <Switch checked={colorMode === 'dark'} onChange={handleToggleDarkMode} sx={{ ml: 'auto' }} />*/}
    {/*</MenuItem>*/}

    {/* Preferences |...| Dark Mode Toggle */}
    {/*<Tooltip title={<KeyStroke combo='Ctrl + Shift + P' />}>*/}
    <MenuItem onClick={handleShowSettings}>
      <ListItemDecorator><SettingsOutlinedIcon /></ListItemDecorator>
      Preferences
      <IconButton
        variant='outlined' color='neutral'
        onClick={handleToggleDarkMode}
        sx={{ ml: 'auto' }}
      >
        {colorMode !== 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
      </IconButton>
    </MenuItem>
    {/*</Tooltip>*/}

  </>;
}


// type ContainedAppType = 'chat' | 'data' | 'news';


/**
 * The top bar of the application, with pluggable Left and Right menus, and Center component
 */
export function AppBar(props: { sx?: SxProps }) {

  // state
  // const [value, setValue] = React.useState<ContainedAppType>('chat');

  // external state
  const { centerItems, drawerAnchor, drawerItems, menuAnchor, menuItems } = useLayoutComponents();

  const commonMenuItems = React.useMemo(() =>
    <CommonMenuItems onClose={closeLayoutMenu} />, []);

  return <>

    {/* Top Bar */}
    <Sheet
      variant='solid' color='neutral' invertedColors
      sx={{
        p: 1,
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        ...(props.sx || {}),
      }}>

      {/* Drawer Anchor */}
      {!drawerItems ? (
        <IconButton component={Link} href='/' noLinkStyle variant='plain'>
          <ArrowBackIcon />
        </IconButton>
      ) : (
        <IconButton disabled={!!drawerAnchor || !drawerItems} variant='plain' onClick={event => setLayoutDrawerAnchor(event.currentTarget)}>
          <MenuIcon />
        </IconButton>
      )}

      {/* Center Items */}
      <Box sx={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', my: 'auto' }}>
        {!!centerItems ? centerItems : <AppBarTitle />}
      </Box>

      {/* Menu Anchor */}
      <IconButton disabled={!!menuAnchor /*|| !menuItems*/} variant='plain' onClick={event => setLayoutMenuAnchor(event.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
    </Sheet>


    {/* Drawer Menu */}
    {!!drawerItems && <CloseableMenu
      maxHeightGapPx={56 + 24} sx={{ minWidth: 320 }}
      open={!!drawerAnchor} anchorEl={drawerAnchor} onClose={closeLayoutDrawer}
      placement='bottom-start'
    >
      {drawerItems}
    </CloseableMenu>}

    {/* Menu Menu */}
    <CloseableMenu
      maxHeightGapPx={56 + 24} noBottomPadding noTopPadding sx={{ minWidth: 320 }}
      open={!!menuAnchor} anchorEl={menuAnchor} onClose={closeLayoutMenu}
      placement='bottom-end'
    >
      {commonMenuItems}
      {!!menuItems && <ListDivider sx={{ mt: 0 }} />}
      {!!menuItems && <Box sx={{ overflowY: 'auto' }}>{menuItems}</Box>}
      {!!menuItems && <ListDivider sx={{ mb: 0 }} />}
      <AppBarSwitcherItem />
      {/*<AppBarSupportItem />*/}
    </CloseableMenu>

  </>;
}