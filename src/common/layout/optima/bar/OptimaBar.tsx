import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Dropdown, IconButton, ListDivider, ListItem, ListItemDecorator, Menu, MenuButton, MenuItem, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EngineeringIcon from '@mui/icons-material/Engineering';
import FeedbackIcon from '@mui/icons-material/Feedback';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import NewReleasesIcon from '@mui/icons-material/NewReleases';

import { BuildInfoCard } from '../../../../apps/news/AppNews';
import { blocksRenderHTMLIFrameCss } from '~/modules/blocks/code/code-renderers/RenderCodeHtmlIFrame';

import { BigAgiSquircleIcon } from '~/common/components/icons/big-agi/BigAgiSquircleIcon';
import { Brand } from '~/common/app.config';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { LayoutSidebarRight } from '~/common/components/icons/LayoutSidebarRight';
import { Link } from '~/common/components/Link';
import { Release } from '~/common/app.release';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { checkVisibleNav, NavItemApp } from '~/common/app.nav';
import { navigateToIndex, ROUTE_INDEX } from '~/common/app.routes';
// import { useDynamicUsersnap } from '~/common/components/3rdparty/Usersnap';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import { InvertedBar, InvertedBarCornerItem } from '../InvertedBar';
import { PopupPanel } from '../panel/PopupPanel';
import { optimaOpenDrawer, optimaOpenPanel, optimaTogglePanel, useOptimaPanelOpen } from '../useOptima';
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
  /**
   * NOTE: shall we fall back to the 'standard' release notes when not available on the tenant?
   * - prob not because this could be a per-company deployment, and we don't know the tenant's release notes
   */
  const releaseNotesUrl = Release.App.releaseNotes;
  // const { openUsersnap, loadingError: usersnapLoadingError } = useDynamicUsersnap();
  const { showPromisedOverlay } = useOverlayComponents();
  const hasDrawerContent = useOptimaPortalHasInputs('optima-portal-drawer');
  const { panelAsPopup, panelHasContent, panelShownAsPanel, panelShownAsPopup } = useOptimaPanelOpen(props.isMobile, props.currentApp);

  // derived state
  const navIsShown = checkVisibleNav(props.currentApp);


  // Handlers

  const handleShowReleaseNotes = React.useCallback(async () => {
    if (!releaseNotesUrl) return;
    return await showPromisedOverlay('app-recent-changes', { rejectWithValue: false }, ({ onResolve, onUserReject }) =>
      <GoodModal
        open
        onClose={onUserReject}
        noTitleBar
        themedColor='neutral'
        unfilterBackdrop
        sx={{ minWidth: { xs: 400, sm: 580, md: 780, lg: 890 } }}
      >
        <iframe
          src={releaseNotesUrl}
          style={{ ...blocksRenderHTMLIFrameCss, height: '70svh' }}
          title='Release Notes Embed'
          loading='lazy' // do not load until visible in the viewport
        />
      </GoodModal>,
    );
  }, [releaseNotesUrl, showPromisedOverlay]);

  const handleShowTechnologies = React.useCallback(async () => {
    return await showPromisedOverlay<void>('app-recent-changes', {}, ({ onResolve }) =>
      <GoodModal open onClose={onResolve} noTitleBar unfilterBackdrop>
        <BuildInfoCard noMargin />
      </GoodModal>,
    );
  }, [showPromisedOverlay]);

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

      {/* (PREVIEW) Preview Menu */}
      {!props.isMobile && (
        <Dropdown>
          <MenuButton
            aria-label='Notifications Menu'
            slots={{ root: IconButton }}
            slotProps={{ root: { size: 'md' } }}
          >
            {/*<NotificationsNoneOutlinedIcon />*/}
            <LightbulbOutlinedIcon />
            {/*<FeedbackOutlinedIcon />*/}
          </MenuButton>

          <Menu placement='bottom-end' sx={{ minWidth: 220 }}>
            <ListItem>
              <Typography level='body-xs' sx={{ textTransform: 'uppercase' }}>
                {Release.App.versionName}
              </Typography>
            </ListItem>

            {!!releaseNotesUrl && (
              <MenuItem onClick={handleShowReleaseNotes}>
                <ListItemDecorator><NewReleasesIcon /></ListItemDecorator>
                Release Notes
              </MenuItem>
            )}
            <MenuItem onClick={handleShowTechnologies}>
              {/*<ListItemDecorator><EventNoteOutlinedIcon /></ListItemDecorator>*/}
              <ListItemDecorator><EngineeringIcon /></ListItemDecorator>
              Build Info
            </MenuItem>



            {/*<ListDivider />*/}

            {/*<TooltipOutlined title={usersnapLoadingError}>*/}
            {/*  <MenuItem onClick={openUsersnap}>*/}
            {/*    <ListItemDecorator><FeedbackIcon /></ListItemDecorator>*/}
            {/*    Feedback -&gt; Enrico*/}
            {/*  </MenuItem>*/}
            {/*</TooltipOutlined>*/}
          </Menu>
        </Dropdown>
      )}

      {/* Panel Open: has content always on Mobile (the app menu) */}
      {panelHasContent && (
        <InvertedBarCornerItem>
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