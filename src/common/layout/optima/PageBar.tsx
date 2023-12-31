import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, ListDivider, ListItemDecorator, MenuItem, Typography, useColorScheme } from '@mui/joy';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { Brand } from '~/common/app.config';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { Link } from '~/common/components/Link';
import { ROUTE_INDEX } from '~/common/app.routes';

import { AppBarSwitcherItem } from './components/AppBarSwitcherItem';
import { InvertedBar, InvertedBarCornerItem } from './components/InvertedBar';
import { useOptimaLayout } from './useOptimaLayout';
import { useOptimaDrawer } from '~/common/layout/optima/useOptimaDrawer';


function AppBarTitle() {
  return (
    <Link href={ROUTE_INDEX}>
      <AgiSquircleIcon sx={{
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
  const { openPreferencesTab } = useOptimaLayout();
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const handleShowSettings = (event: React.MouseEvent) => {
    event.stopPropagation();
    openPreferencesTab();
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
        variant='outlined'
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
export function PageBar(props: { isMobile?: boolean, sx?: SxProps }) {

  // state
  // const [value, setValue] = React.useState<ContainedAppType>('chat');

  // external state
  const {
    appBarItems, appPaneContent, appMenuAnchor, appMenuItems,
    closeAppMenu, setAppMenuAnchor,
  } = useOptimaLayout();
  const {
    openDrawer,
  } = useOptimaDrawer();

  const commonMenuItems = React.useMemo(() =>
    <CommonMenuItems onClose={closeAppMenu} />, [closeAppMenu]);

  return <>

    <InvertedBar direction='horizontal' sx={props.sx}>

      {/* [Mobile] Drawer button */}
      {!!props.isMobile && (

        <IconButton disabled={!appPaneContent} onClick={openDrawer}>
          <MenuIcon />
        </IconButton>

      )}

      {/* Drawer Anchor */}
      {/*{!appPaneContent ? (*/}
      {/*  <IconButton component={Link} href={ROUTE_INDEX} noLinkStyle>*/}
      {/*    <ArrowBackIcon />*/}
      {/*  </IconButton>*/}
      {/*) : (*/}
      {/*  <IconButton disabled={!!appDrawerAnchor || !appPaneContent} onClick={event => setAppDrawerAnchor(event.currentTarget)}>*/}
      {/*    <MenuIcon />*/}
      {/*  </IconButton>*/}
      {/*)}*/}

      {/* Center Items */}
      <Box sx={{
        flexGrow: 1,
        minHeight: 'var(--Bar)',
        display: 'flex', flexFlow: 'row wrap', justifyContent: 'center', alignItems: 'center',
        my: 'auto',
      }}>
        {!!appBarItems ? appBarItems : <AppBarTitle />}
      </Box>

      {/* Menu Anchor */}
      <InvertedBarCornerItem>
        <IconButton disabled={!!appMenuAnchor /*|| !appMenuItems*/} onClick={event => setAppMenuAnchor(event.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
      </InvertedBarCornerItem>

    </InvertedBar>


    {/* Menu Menu */}
    <CloseableMenu
      maxHeightGapPx={56 + 24} noBottomPadding noTopPadding sx={{ minWidth: 320 }}
      open={!!appMenuAnchor} anchorEl={appMenuAnchor} onClose={closeAppMenu}
      placement='bottom-end'
    >
      {commonMenuItems}
      {!!appMenuItems && <ListDivider sx={{ mt: 0 }} />}
      {!!appMenuItems && <Box sx={{ overflowY: 'auto' }}>{appMenuItems}</Box>}
      {!!appMenuItems && <ListDivider sx={{ mb: 0 }} />}
      <AppBarSwitcherItem />
      {/*<AppBarSupportItem />*/}
    </CloseableMenu>

  </>;
}