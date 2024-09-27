import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, MenuList, Typography, useColorScheme } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import SettingsIcon from '@mui/icons-material/Settings';

import { overlayButtonsActiveSx } from '~/modules/blocks/OverlayButton';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { Brand } from '~/common/app.config';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { Link } from '~/common/components/Link';
import { ROUTE_INDEX } from '~/common/app.routes';
import { WindowPaneRightOpen } from '~/common/components/icons/WindowPaneRightOpen';
import { checkVisibleNav, NavItemApp } from '~/common/app.nav';

import { InvertedBar, InvertedBarCornerItem } from '../InvertedBar';
import { OptimaPanelIn } from '../portals/OptimaPortalsIn';
import { optimaCloseAppMenu, optimaOpenAppMenu, optimaOpenDrawer, optimaOpenPanel, optimaOpenPreferences, optimaTogglePanel, useOptimaAppMenu, useOptimaAppMenuOpen, useOptimaPanelOpen } from '../useOptima';
import { useOptimaPortalHasInputs } from '../portals/useOptimaPortalHasInputs';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';


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

const panelMenuListSx: SxProps = {
  borderRadius: 0,
  border: 'none',
  background: 'transparent',
  py: 0,
  gap: 'var(--ListDivider-gap)',
};

const panelSectionHeaderSx: SxProps = {
  fontSize: 'sm',
  fontWeight: 'lg',
  borderBottom: '1px solid',
  borderBottomColor: 'divider',
  // '--A': 'var(--joy-palette-background-level1)',
  // '--B': 'var(--joy-palette-background-popup)',
  // background: 'linear-gradient(45deg, var(--A) 25%, var(--B) 25%, var(--B) 50%, var(--A) 50%, var(--A) 75%, var(--B) 75%)',
  // backgroundSize: '40px 40px',
  // boxShadow: 'xs',
  py: 1,
};

const panelSelectionHeaderRowSx: SxProps = {
  flex: 1,
  // layout
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 1,
  // show the button on hover
  '&:hover > button': overlayButtonsActiveSx,
};

const panelSelectionHeaderButtonSx: SxProps = {
  my: -0.5,
  opacity: 0,
  pointerEvents: 'none',
};


function CommonAppMenuItems(props: { onClose: () => void }) {

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

    {/* Preferences |...| Dark Mode Toggle */}
    {/*<Tooltip title={<KeyStroke combo='Ctrl + ,' />}>*/}
    <MenuItem onClick={handleShowSettings}>
      <ListItemDecorator><SettingsIcon /></ListItemDecorator>
      Preferences{/*<KeyStroke combo='Ctrl + ,' />*/}
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
export function OptimaBar(props: { component: React.ElementType, currentApp?: NavItemApp, isMobile: boolean, sx?: SxProps }) {

  // state
  // const [value, setValue] = React.useState<ContainedAppType>('chat');
  const appMenuAnchor = React.useRef<HTMLButtonElement>(null);

  // external state
  const hasDrawerContent = useOptimaPortalHasInputs('optima-portal-drawer');
  // const hasPanelContent = useOptimaPortalHasInputs('optima-portal-panel');
  const appMenuItems = useOptimaAppMenu();
  const isAppMenuOpen = useOptimaAppMenuOpen();
  const isPanelOpen = useOptimaPanelOpen();

  // derived state
  const menuToPanelDesktop = !!props.currentApp?.appMenuToPanel;
  const menuToPanelMobile = props.isMobile;
  const menuToPanel = menuToPanelDesktop || menuToPanelMobile;

  const commonAppMenuItems = React.useMemo(() => {
    return <CommonAppMenuItems onClose={optimaCloseAppMenu} />;
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

      {/* App Menu Anchor */}
      <InvertedBarCornerItem>
        <IconButton
          ref={appMenuAnchor}
          disabled={menuToPanel ? false : !appMenuAnchor /*|| (!appMenuItems && !props.isMobile)*/}
          onClick={menuToPanel ? optimaTogglePanel : optimaOpenAppMenu /* onPointerDown doesn't work well with a menu (the 'up' event would close it), so we're still with onClick */}
          onContextMenu={menuToPanel ? optimaOpenPanel : optimaOpenAppMenu /* important to get the 'preventDefault' for the Right mouse click (to prevent the menu) */}
          // sx={!menuToPanel ? undefined : {
          //   transform: isPanelOpen ? 'rotate(180deg)' : 'none',
          //   transition: 'transform 0.42s',
          // }}
        >
          {isPanelOpen ? <NavigateNextRoundedIcon /> : menuToPanel ? <WindowPaneRightOpen /> : <MoreVertIcon />}
          {/*{isPanelOpen ? <NavigateNextRoundedIcon /> : <WindowPaneRightOpen />}*/}
          {/*{menuToPanel ? <NavigateBeforeRoundedIcon /> : <MoreVertIcon />}*/}
        </IconButton>
      </InvertedBarCornerItem>

    </InvertedBar>

    {/*</Box>*/}

    {menuToPanel ? (

      <OptimaPanelIn>
        <MenuList variant='plain' sx={panelMenuListSx}>

          {/* Common (Preferences) */}

          <ListItem variant='soft' sx={panelSectionHeaderSx}>
            <Box sx={panelSelectionHeaderRowSx}>
              App
              {/*<IconButton variant='soft' size='sm' sx={panelSelectionHeaderButtonSx}>*/}
              {/*  {false ? <ExpandLessIcon /> : <ExpandMoreIcon />}*/}
              {/*</IconButton>*/}
            </Box>
          </ListItem>

          {commonAppMenuItems}


          {/* App Menu Items */}

          {!!appMenuItems && <ListItem variant='soft' sx={panelSectionHeaderSx}>
            <Box sx={panelSelectionHeaderRowSx}>
              {props.currentApp?.name || 'Menu'}
              {/*<IconButton variant='soft' size='sm' sx={panelSelectionHeaderButtonSx}>*/}
              {/*  {false ? <ExpandLessIcon /> : <ExpandMoreIcon />}*/}
              {/*</IconButton>*/}
            </Box>
          </ListItem>}

          {!!appMenuItems && <Box sx={{ overflowY: 'auto' }}>{appMenuItems}</Box>}

        </MenuList>
      </OptimaPanelIn>

    ) : (

      <CloseableMenu
        dense maxHeightGapPx={56 + 24} noBottomPadding={props.isMobile} placement='bottom-end'
        open={isAppMenuOpen && !!appMenuAnchor.current} anchorEl={appMenuAnchor.current} onClose={optimaCloseAppMenu}
        sx={{ minWidth: 280 }}
      >

        {/* Common (Preferences) */}
        {commonAppMenuItems}

        {/* App Menu Items */}
        {!!appMenuItems && <ListDivider />}
        {!!appMenuItems && <Box sx={{ overflowY: 'auto' }}>{appMenuItems}</Box>}

      </CloseableMenu>

    )}

  </>;
}