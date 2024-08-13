import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, ListDivider, ListItemDecorator, MenuItem, Typography, useColorScheme } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SettingsIcon from '@mui/icons-material/Settings';

import { checkVisibleNav, NavItemApp } from '~/common/app.nav';
import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { Brand } from '~/common/app.config';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { Link } from '~/common/components/Link';
import { ROUTE_INDEX } from '~/common/app.routes';

import { InvertedBar, InvertedBarCornerItem } from './components/InvertedBar';
import { MobileNavListItem } from './MobileNavListItem';
import { optimaCloseAppMenu, optimaOpenAppMenu, optimaOpenDrawer, optimaOpenPreferences, useOptimaAppMenu, useOptimaAppMenuOpen } from './useOptima';
import { useOptimaPortalHasInputs } from './portals/useOptimaPortalHasInputs';
import { useOptimaPortalOutRef } from './portals/useOptimaPortalOutRef';


const PageBarItemsFallback = (props: { currentApp?: NavItemApp }) =>
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    gap: { xs: 1, md: 2 },
  }}>
    <Link href={ROUTE_INDEX}>
      <AgiSquircleIcon inverted sx={{ width: 32, height: 32, color: 'white' }} />
    </Link>

    <Typography level='title-md'>
      {props.currentApp?.barTitle || props.currentApp?.name || Brand.Title.Base}
    </Typography>
  </Box>;


const centerItemsContainerSx: SxProps = {
  flexGrow: 1,
  minHeight: 'var(--Bar)',
  display: 'flex', flexFlow: 'row wrap', justifyContent: 'center', alignItems: 'center',
  my: 'auto',
  gap: { xs: 0, md: 1 },
  // [electron] make the blank part of the bar draggable (and not the contents)
  WebkitAppRegion: 'drag',
  '& > *': { WebkitAppRegion: 'no-drag' },
};

function CenterItemsPortal(props: {
  currentApp?: NavItemApp,
}) {

  // state
  const hasInputs = useOptimaPortalHasInputs('optima-portal-toolbar');
  const portalToolbarRef = useOptimaPortalOutRef('optima-portal-toolbar', 'PageBar.CenterItemsContainer');

  return (
    <Box ref={portalToolbarRef} sx={centerItemsContainerSx}>
      {hasInputs ? null : <PageBarItemsFallback currentApp={props.currentApp} />}
    </Box>
  );
}


function CommonPageMenuItems(props: { onClose: () => void }) {

  // external state
  const { mode: colorMode, setMode: setColorMode } = useColorScheme();

  const { onClose } = props;
  const handleShowSettings = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    optimaOpenPreferences();
    onClose();
  }, [onClose]);

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
    {/*<Tooltip title={<KeyStroke combo='Ctrl + ,' />}>*/}
    <MenuItem onClick={handleShowSettings}>
      <ListItemDecorator><SettingsIcon /></ListItemDecorator>
      Preferences
      <IconButton
        size='sm'
        variant='soft'
        onClick={handleToggleDarkMode}
        sx={{ ml: 'auto', /*mr: '2px',*/ my: '-0.25rem' /* absorb the menuItem padding */ }}
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
export function PageBar(props: { component: React.ElementType, currentApp?: NavItemApp, isMobile: boolean, sx?: SxProps }) {

  // state
  // const [value, setValue] = React.useState<ContainedAppType>('chat');
  const pageMenuAnchor = React.useRef<HTMLButtonElement>(null);

  // external state
  const hasDrawerContent = useOptimaPortalHasInputs('optima-portal-drawer');
  const appMenuItems = useOptimaAppMenu();
  const isAppMenuOpen = useOptimaAppMenuOpen();

  const commonPageMenuItems = React.useMemo(() => {
    return <CommonPageMenuItems onClose={optimaCloseAppMenu} />;
  }, []);

  // [Desktop] hide the app bar if the current app doesn't use it
  const desktopHide = !!props.currentApp?.hideBar && !props.isMobile;
  if (desktopHide)
    return null;

  return <>

    {/* This will animate the height from 0 to auto (and the bar is overflow:hidden */}
    {/* But we're not using it yet as a NextJS page transition is a full removal */}
    {/*<Box sx={{*/}
    {/*  display: 'grid',*/}
    {/*  gridTemplateRows: desktopHide ? '0fr' : '1fr',*/}
    {/*  transition: 'grid-template-rows 1.42s linear',*/}
    {/*}}>*/}

    <InvertedBar
      component={props.component}
      direction='horizontal'
      sx={props.sx}
    >

      {/* [Mobile] Drawer button */}
      {(props.isMobile || !checkVisibleNav(props.currentApp)) && (
        <InvertedBarCornerItem>

          {(!hasDrawerContent || !checkVisibleNav(props.currentApp)) ? (
            <IconButton component={Link} href={ROUTE_INDEX} noLinkStyle>
              <ArrowBackIcon />
            </IconButton>
          ) : (
            <IconButton disabled={!hasDrawerContent} onPointerDown={optimaOpenDrawer}>
              <MenuIcon />
            </IconButton>
          )}

        </InvertedBarCornerItem>
      )}

      {/* Pluggable Toolbar Items */}
      <CenterItemsPortal currentApp={props.currentApp} />

      {/* Page Menu Anchor */}
      <InvertedBarCornerItem>
        <IconButton
          ref={pageMenuAnchor}
          disabled={!pageMenuAnchor /*|| (!appMenuItems && !props.isMobile)*/}
          onClick={optimaOpenAppMenu /* onPointerDown doesn't work well with a menu (the 'up' event would close it), so we're still with onClick */}
          onContextMenu={optimaOpenAppMenu /* important to get the 'preventDefault' for the Right mouse click (to prevent the menu) */}
        >
          <MoreVertIcon />
        </IconButton>
      </InvertedBarCornerItem>

    </InvertedBar>

    {/*</Box>*/}


    {/* App (fka. Page) Menu */}
    <CloseableMenu
      dense maxHeightGapPx={56 + 24} noBottomPadding={props.isMobile} placement='bottom-end'
      open={isAppMenuOpen && !!pageMenuAnchor.current} anchorEl={pageMenuAnchor.current} onClose={optimaCloseAppMenu}
      sx={{ minWidth: 280 }}
    >

      {/* Common (Preferences) */}
      {commonPageMenuItems}

      {/* App Menu Items */}
      {!!appMenuItems && <ListDivider />}
      {!!appMenuItems && <Box sx={{ overflowY: 'auto' }}>{appMenuItems}</Box>}

      {/* [Mobile] Nav is implemented at the bottom of the Page Menu (for now) */}
      {props.isMobile && !!appMenuItems && <ListDivider sx={{ mb: 0 }} />}
      {props.isMobile && <MobileNavListItem variant='solid' currentApp={props.currentApp} />}

    </CloseableMenu>

  </>;
}