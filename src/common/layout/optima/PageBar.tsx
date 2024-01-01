import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, ListDivider, ListItemDecorator, MenuItem, Typography, useColorScheme } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
import { useOptimaDrawers } from '~/common/layout/optima/useOptimaDrawers';
import type { NavItemApp } from '~/common/app.nav';


function PageBarItemsFallback() {
  return (
    <Link href={ROUTE_INDEX}>
      <AgiSquircleIcon inverted sx={{
        width: 32,
        height: 32,
        color: 'white',
      }} />
      <Typography sx={{
        ml: { xs: 1, md: 2 },
        color: 'white',
        textDecoration: 'none',
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
export function PageBar(props: { currentApp?: NavItemApp, isMobile?: boolean, sx?: SxProps }) {

  // state
  // const [value, setValue] = React.useState<ContainedAppType>('chat');
  const pageMenuAnchor = React.useRef<HTMLButtonElement>(null);

  // external state
  const {
    appBarItems, appPaneContent, appMenuItems,
  } = useOptimaLayout();
  const {
    openDrawer,
    isPageMenuOpen, openPageMenu, closePageMenu,
  } = useOptimaDrawers();

  const commonMenuItems = React.useMemo(() => {
    return <CommonMenuItems onClose={closePageMenu} />;
  }, [closePageMenu]);

  // [Desktop] hide the app bar if the current app doesn't use it
  if (props.currentApp?.hideBar && !props.isMobile)
    return null;

  return <>

    <InvertedBar direction='horizontal' sx={props.sx}>

      {/* [Mobile] Drawer button */}
      {!!props.isMobile && (
        <InvertedBarCornerItem>

          {!appPaneContent ? (
            <IconButton component={Link} href={ROUTE_INDEX} noLinkStyle>
              <ArrowBackIcon />
            </IconButton>
          ) : (
            <IconButton disabled={!appPaneContent} onClick={openDrawer}>
              <MenuIcon />
            </IconButton>
          )}

        </InvertedBarCornerItem>
      )}

      {/* Center Items */}
      <Box sx={{
        flexGrow: 1,
        minHeight: 'var(--Bar)',
        display: 'flex', flexFlow: 'row wrap', justifyContent: 'center', alignItems: 'center',
        my: 'auto',
      }}>
        {!!appBarItems ? appBarItems : <PageBarItemsFallback />}
      </Box>

      {/* Page Menu Anchor */}
      <InvertedBarCornerItem>
        <IconButton disabled={!pageMenuAnchor || (!appMenuItems && !props.isMobile)} onClick={openPageMenu} ref={pageMenuAnchor}>
          <MoreVertIcon />
        </IconButton>
      </InvertedBarCornerItem>

    </InvertedBar>


    {/* Page Menu */}
    <CloseableMenu
      maxHeightGapPx={56 + 24} noBottomPadding noTopPadding sx={{ minWidth: 320 }}
      open={isPageMenuOpen && !!pageMenuAnchor.current} anchorEl={pageMenuAnchor.current} onClose={closePageMenu}
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