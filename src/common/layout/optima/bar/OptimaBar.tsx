import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, MenuList, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { Brand } from '~/common/app.config';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { LayoutSidebarRight } from '~/common/components/icons/LayoutSidebarRight';
import { Link } from '~/common/components/Link';
import { ROUTE_INDEX } from '~/common/app.routes';
import { checkVisibleNav, NavItemApp } from '~/common/app.nav';

import { InvertedBar, InvertedBarCornerItem } from '../InvertedBar';
import { OPTIMA_PANEL_GROUPS_SPACING } from '../panel/OptimaPanelGroup';
import { OptimaPanelIn } from '../portals/OptimaPortalsIn';
import { OptimaPreferencesMenuItem } from '../panel/OptimaPreferencesMenuItem';
import { optimaCloseAppMenu, optimaClosePanel, optimaOpenAppMenu, optimaOpenDrawer, optimaOpenPanel, optimaTogglePanel, useOptimaAppMenu, useOptimaAppMenuOpen, useOptimaPanelOpen } from '../useOptima';
import { useOptimaPortalHasInputs } from '../portals/useOptimaPortalHasInputs';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';


// Center Items (Portal)

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


// Panel

const panelMenuListSx: SxProps = {
  borderRadius: 0,
  border: 'none',
  background: 'transparent',
  pt: 0, // disableTopGutter or similar
  // gap: 'var(--ListDivider-gap)',
  // overflow: 'hidden',
  gap: OPTIMA_PANEL_GROUPS_SPACING,
};

function RenderAsPanel(props: {
  appMenuItems: React.ReactNode,
  appName?: string,
  isMobile: boolean,
}) {

  // const hasPanelContent = useOptimaPortalHasInputs('optima-portal-panel');

  return (
    <OptimaPanelIn>
      <MenuList variant='plain' sx={panelMenuListSx}>

        {/* [Mobile] Preferences */}
        {props.isMobile && (
          <Box sx={{ mt: 2.25, mb: OPTIMA_PANEL_GROUPS_SPACING - 2.75 }}>
            <OptimaPreferencesMenuItem onCloseMenu={optimaClosePanel} />
            {/*<ListDivider />*/}
          </Box>
        )}

        {/* App Menu Items */}
        {props.appMenuItems}

      </MenuList>
    </OptimaPanelIn>
  );
}


// Popup Menu

function RenderAsPopupDesktopOnly(props: {
  menuAnchor: React.RefObject<HTMLButtonElement>,
  menuContent: React.ReactNode,
}) {

  // external state
  const isAppMenuOpen = useOptimaAppMenuOpen();

  // don't render if closed or missing anchor or content
  if (!props.menuContent || !props.menuAnchor.current || !isAppMenuOpen)
    return null;

  return (
    <CloseablePopup
      menu anchorEl={props.menuAnchor.current} onClose={optimaCloseAppMenu}
      dense
      maxHeightGapPx={56 + 24}
      minWidth={280}
      placement='bottom-end'
    >

      {/* contents rendered in a desktop popup menu */}
      {props.menuContent}

    </CloseablePopup>
  );
}


/**
 * The top bar of the application, with pluggable Left and Right menus, and Center component
 */
export function OptimaBar(props: { component: React.ElementType, currentApp?: NavItemApp, isMobile: boolean, sx?: SxProps }) {

  // state
  const appMenuAnchor = React.useRef<HTMLButtonElement>(null);

  // external state
  const hasDrawerContent = useOptimaPortalHasInputs('optima-portal-drawer');
  const panelContent = useOptimaAppMenu();
  const panelIsOpen = useOptimaPanelOpen();

  // derived state
  const navIsShown = checkVisibleNav(props.currentApp);

  const contentToPopup = !props.isMobile && props.currentApp?.panelAsMenu === true;

  // [Desktop] hide the app bar if the current app doesn't use it
  const desktopHideBarAndMenus = !props.isMobile && !panelContent && !!props.currentApp?.hideBar;
  if (desktopHideBarAndMenus)
    return null;

  return <>

    {/* Bar: [Drawer control] [Center Items] [Panel/Menu control] */}
    <InvertedBar component={props.component} direction='horizontal' sx={props.sx}>

      {/* [Mobile] Drawer button */}
      {(props.isMobile || !navIsShown) && (
        <InvertedBarCornerItem>
          {(hasDrawerContent && navIsShown) ? (
            // show the drawer button
            <IconButton disabled={!hasDrawerContent} onPointerDown={optimaOpenDrawer}>
              <MenuIcon />
            </IconButton>
          ) : (
            // back button
            <IconButton component={Link} href={ROUTE_INDEX} noLinkStyle>
              <ArrowBackIcon />
            </IconButton>
          )}
        </InvertedBarCornerItem>
      )}

      {/* Pluggable Toolbar Items */}
      <CenterItemsPortal currentApp={props.currentApp} />

      {/* Panel/Menu button */}
      {(props.isMobile || !!panelContent) && (
        <InvertedBarCornerItem>
          {/*<Tooltip disableInteractive title={contentToPopup ? (panelIsOpen ? 'Close' : 'Open') + ' Menu' : (panelIsOpen ? 'Close' : 'Open')}>*/}
          <IconButton
            ref={appMenuAnchor}
            disabled={contentToPopup ? !appMenuAnchor : false}
            onClick={contentToPopup ? optimaOpenAppMenu : optimaTogglePanel /* onPointerDown doesn't work well with a menu (the 'up' event would close it), so we're still with onClick */}
            onContextMenu={contentToPopup ? optimaOpenAppMenu : optimaOpenPanel /* important to get the 'preventDefault' for the Right mouse click (to prevent the menu) */}
          >
            {panelIsOpen ? <NavigateNextIcon />
              : contentToPopup ? <MoreVertIcon />
                : <LayoutSidebarRight /> /* aa*/} {/* WindowPaneRightOpen */}
          </IconButton>
          {/*</Tooltip>*/}
        </InvertedBarCornerItem>
      )}

    </InvertedBar>

    {/* Default: Panel render */}
    {!contentToPopup && <RenderAsPanel appMenuItems={panelContent} appName={props.currentApp?.name} isMobile={props.isMobile} />}

    {/* Desktop-only opt-in by Apps */}
    {contentToPopup && <RenderAsPopupDesktopOnly menuAnchor={appMenuAnchor} menuContent={panelContent} />}

  </>;
}