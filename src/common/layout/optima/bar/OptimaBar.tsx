import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, IconButton, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

import { BigAgiSquircleIcon } from '~/common/components/icons/big-agi/BigAgiSquircleIcon';
import { Brand } from '~/common/app.config';
import { LayoutSidebarRight } from '~/common/components/icons/LayoutSidebarRight';
import { Link } from '~/common/components/Link';
import { checkVisibleNav, NavItemApp } from '~/common/app.nav';
import { navigateToIndex, ROUTE_INDEX } from '~/common/app.routes';

import { InvertedBar, InvertedBarCornerItem } from '../InvertedBar';
import { PopupPanel } from '../panel/PopupPanel';
import { optimaActions, optimaOpenDrawer, optimaOpenPanel, optimaTogglePanel, useOptimaPanelOpen } from '../useOptima';
import { useOptimaPortalHasInputs } from '../portals/useOptimaPortalHasInputs';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';


// Center Items (Portal)

const centerItemsContainerSx: SxProps = {
  flexGrow: 1,
  minHeight: 'var(--Bar)',
  display: 'flex', flexFlow: 'row wrap', justifyContent: 'center', alignItems: 'center',
  my: 'auto',
  gap: { xs: 0, md: 1 },
  // ensure we can keep the plugged center bars in check
  overflow: 'hidden',
  // [electron] make the blank part of the bar draggable (and not the contents)
  WebkitAppRegion: 'drag',
  '& > *': { WebkitAppRegion: 'no-drag' },
};

function CenterItemsPortal(props: { currentApp?: NavItemApp }) {

  // external state
  const portalToolbarRef = useOptimaPortalOutRef('optima-portal-toolbar', 'PageBar.CenterItemsContainer');
  const hasInputs = useOptimaPortalHasInputs('optima-portal-toolbar');

  return (
    <Box ref={portalToolbarRef} sx={centerItemsContainerSx}>

      {/* Only if nobody's injecting in the Toolbar portal, show the fallback */}
      {!hasInputs && <CenterItemsFallback currentApp={props.currentApp} />}

    </Box>
  );
}

function CenterItemsFallback(props: { currentApp?: NavItemApp }) {
  return <Box sx={{
    display: 'flex',
    alignItems: 'center',
    gap: { xs: 1, md: 2 },
  }}>

    {/* Squircle */}
    <Link href={ROUTE_INDEX}>
      <BigAgiSquircleIcon inverted sx={{ width: 32, height: 32, color: 'white' }} />
    </Link>

    {/* Title */}
    <Typography level='title-md'>
      {props.currentApp?.barTitle || props.currentApp?.name || Brand.Title.Base}
    </Typography>

  </Box>;
}


/**
 * Top bar displayed on the Optima Layout
 */
export function OptimaBar(props: { component: React.ElementType, currentApp?: NavItemApp, isMobile: boolean, sx?: SxProps }) {

  // state
  const appMenuAnchor = React.useRef<HTMLButtonElement>(null);

  // external state
  const hasDrawerContent = useOptimaPortalHasInputs('optima-portal-drawer');
  const { panelAsPopup, panelHasContent, panelShownAsPanel, panelShownAsPeeking, panelShownAsPopup } = useOptimaPanelOpen(props.isMobile, props.currentApp);

  // derived state
  const navIsShown = checkVisibleNav(props.currentApp);

  // [Desktop] optionally hide the Bar if the current app asks for it
  if (props.currentApp?.hideBar && !props.isMobile && !panelHasContent)
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
            <IconButton onClick={() => navigateToIndex()}>
              <ArrowBackIcon />
            </IconButton>
          )}
        </InvertedBarCornerItem>
      )}

      {/* Pluggable Toolbar Items */}
      <CenterItemsPortal currentApp={props.currentApp} />

      {/* We used to have the Preview (lightbulb) menu here */}

      {/* Panel Open: has content always on Mobile (the app menu) */}
      {panelHasContent && (
        <InvertedBarCornerItem
           onMouseEnter={(props.isMobile || panelAsPopup || panelShownAsPanel) ? undefined : optimaActions().peekPanelEnter}
           onMouseLeave={(props.isMobile || panelShownAsPeeking) ? undefined : optimaActions().peekPanelLeave}
        >
          {/*<Tooltip disableInteractive title={contentToPopup ? (panelIsOpen ? 'Close' : 'Open') + ' Menu' : (panelIsOpen ? 'Close' : 'Open')}>*/}
          <IconButton
            ref={appMenuAnchor}
            // disabled={contentToPopup ? !appMenuAnchor : false}
            onClick={optimaTogglePanel /* onPointerDown doesn't work well with a menu (the 'up' event would close it), so we're still with onClick */}
            onContextMenu={optimaOpenPanel /* important to get the 'preventDefault' for the Right mouse click (to prevent the menu) */}
          >
            {panelShownAsPanel ? <NavigateNextIcon />
              : panelAsPopup ? <MoreVertIcon />
                : <LayoutSidebarRight /> /* aa*/} {/* WindowPaneRightOpen */}
          </IconButton>
          {/*</Tooltip>*/}
        </InvertedBarCornerItem>
      )}

    </InvertedBar>

    {/* Use a Popup containing the Panel Portal */}
    {panelShownAsPopup && !!appMenuAnchor.current && <PopupPanel anchorEl={appMenuAnchor.current} />}

  </>;
}