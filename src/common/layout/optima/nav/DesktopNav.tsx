import * as React from 'react';
import Router from 'next/router';

import type { SxProps } from '@mui/joy/styles/types';
import { Divider, Dropdown, FormHelperText, ListDivider, ListItem, ListItemButton, ListItemDecorator, Menu, MenuButton, MenuItem, Tooltip, Typography } from '@mui/joy';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import CodeIcon from '@mui/icons-material/Code';
import HistoryIcon from '@mui/icons-material/History';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import TerminalOutlinedIcon from '@mui/icons-material/TerminalOutlined';

import { blocksRenderHTMLIFrameCss } from '~/modules/blocks/code/code-renderers/RenderCodeHtmlIFrame';

import { BuildInfoCard } from '../../../../apps/news/AppNews';

import { BaseProduct } from '~/common/app.release';
import { BigAgiSquircleIcon } from '~/common/components/icons/big-agi/BigAgiSquircleIcon';
import { FeatureBadge } from '~/common/components/FeatureBadge';
import { GoodModal } from '~/common/components/modals/GoodModal';
import { PhSquaresFour } from '~/common/components/icons/phosphor/PhSquaresFour';
import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';
import { clientUtmSource } from '~/common/util/pwaUtils';
import { themeZIndexDesktopNav } from '~/common/app.theme';
import { useHasLLMs } from '~/common/stores/llms/llms.hooks';
import { useOverlayComponents } from '~/common/layout/overlays/useOverlayComponents';

import { BringTheLove } from './BringTheLove';
import { DesktopNavGroupBox, DesktopNavIcon, navItemClasses } from './DesktopNavIcon';
import { InvertedBar, InvertedBarCornerItem } from '../InvertedBar';
import { optimaActions, optimaOpenModels, optimaOpenPreferences, optimaToggleDrawer, useOptimaDrawerOpen, useOptimaDrawerPeeking, useOptimaModals } from '../useOptima';
import { scratchClipSupported, useScratchClipVisibility } from '../scratchclip/store-scratchclip';


export const bigAgiProUrl = 'https://big-agi.com' + clientUtmSource('upgrade-apps');


const desktopNavBarSx: SxProps = {
  zIndex: themeZIndexDesktopNav,
};

const bottomGroupSx: SxProps = {
  mb: 'calc(2 * var(--GroupMarginY))',
};

const navItemsDividerSx: SxProps = {
  my: 1,
  width: '50%',
  mx: 'auto',
};


export function DesktopNav(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // state
  const [releaseNotesShown, setReleaseNotesShown] = React.useState(false);

  /**
   * NOTE: shall we fall back to the 'standard' release notes when not available on the tenant?
   * - prob not because this could be a per-company deployment, and we don't know the tenant's release notes
   */
  const releaseNotesUrl = BaseProduct.ReleaseNotes;

  // external state
  const isDrawerOpen = useOptimaDrawerOpen();
  const isDrawerPeeking = useOptimaDrawerPeeking();
  const { showPromisedOverlay } = useOverlayComponents();
  const { showModels, showPreferences } = useOptimaModals();
  const { peekDrawerEnter, peekDrawerLeave } = optimaActions();
  const { isVisible: isScratchClipVisible, toggleVisibility: toggleScratchClipVisibility } = useScratchClipVisibility();

  // derived state
  const noLLMs = !useHasLLMs();


  // handlers

  const handleShowReleaseNotes = React.useCallback(async () => {
    if (!releaseNotesUrl) return;
    setReleaseNotesShown(true);
    return await showPromisedOverlay('app-recent-changes', { rejectWithValue: false }, ({ onUserReject }) =>
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
    return await showPromisedOverlay<boolean>('app-recent-changes', { rejectWithValue: false }, ({ onUserReject }) =>
      <GoodModal open onClose={onUserReject} noTitleBar unfilterBackdrop>
        <BuildInfoCard noMargin />
      </GoodModal>,
    );
  }, [showPromisedOverlay]);


  // show/hide the pane when clicking on the logo
  const appUsesDrawer = !props.currentApp?.hideDrawer;
  const logoButtonTogglesPane = (appUsesDrawer && !isDrawerOpen) || isDrawerOpen;


  // App items
  const navAppItems = React.useMemo(() => {

    // group apps into visible (rendered as of now) and overflow (rendered with a dropdown menu)
    let crossedDivider = false;
    const visibleApps: NavItemApp[] = [];
    const overflowApps: NavItemApp[] = [];

    navItems.apps.forEach((app) => {
      if (checkVisibileIcon(app, false, props.currentApp)) {
        if (!crossedDivider || app === props.currentApp)
          visibleApps.push(app);
        else
          overflowApps.push(app);
        crossedDivider = crossedDivider || checkDivider(app);
      }
    });

    // Application buttons (and group separator)
    const components: React.JSX.Element[] = visibleApps.map((app, appIdx) => {
      const isActive = app === props.currentApp;
      const isDrawerable = isActive && !app.hideDrawer;
      const isPaneOpen = isDrawerable && isDrawerOpen;

      if (checkDivider(app))
        return <Divider key={'app-sep-' + appIdx} sx={navItemsDividerSx} />;

      return (
        <Tooltip key={'n-m-' + app.route.slice(1)} disableInteractive enterDelay={600} title={app.name + (app.isDev ? ' [DEV]' : '')}>
          <DesktopNavIcon
            variant={isActive ? 'solid' : undefined}
            onPointerDown={isDrawerable ? optimaToggleDrawer : () => Router.push(app.landingRoute || app.route)}
            className={`${navItemClasses.typeApp} ${isActive ? navItemClasses.active : ''} ${isPaneOpen ? navItemClasses.paneOpen : ''} ${app.isDev ? navItemClasses.dev : ''}`}
            sx={appIdx !== 0 ? undefined : { '--Icon-fontSize': '1.375rem!important' /* temp patch for the first icon, to go at 22px rather than 1.25rem (20px) */ }}
          >
            {(isActive && app.iconActive) ? <app.iconActive /> : <app.icon />}
            {/*<app.icon />*/}
          </DesktopNavIcon>
        </Tooltip>
      );
    });

    components.push(
      <Dropdown key='nav-quick-menu'>

        <Tooltip disableInteractive enterDelay={600} title='Apps & Tools'>
          <MenuButton slots={{ root: DesktopNavIcon }} slotProps={{ root: { className: navItemClasses.typeApp } }}>
            <PhSquaresFour />
          </MenuButton>
        </Tooltip>

        <Menu
          variant="outlined"
          placement="right-start"
          popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [0, -2] } }] }}
          sx={{ minWidth: 260 }}
        >

          <MenuItem component='a' variant='solid' color='primary' href={bigAgiProUrl} target='_blank' sx={{ minHeight: 40 }}>
            {/*<ListItemDecorator>New</ListItemDecorator>*/}
            {/*<ListItemDecorator><RocketLaunchRounded /></ListItemDecorator>*/}
            Big-AGI Pro
            {/*✨*/}
            <ArrowOutwardRoundedIcon sx={{ ml: 'auto' }}/>
          </MenuItem>

          <ListDivider />

          {/* APPS Section */}
          {overflowApps.length > 0 && (
            <>
              <ListItem>
                <Typography level="body-xs" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
                  Apps
                </Typography>
              </ListItem>
              {overflowApps.map((app, appIdx) =>
                <MenuItem key={'nav-app-extra-' + appIdx} onClick={() => Router.push(app.landingRoute || app.route)}>
                  <ListItemDecorator>
                    <app.icon />
                  </ListItemDecorator>
                  {app.name + (app.isDev ? ' [DEV]' : '')}
                </MenuItem>,
              )}
              <ListDivider />
            </>
          )}

          {/* QUICK TOOLS Section */}
          <ListItem>
            <Typography level="body-xs" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
              Quick Tools
            </Typography>
          </ListItem>
          <MenuItem onClick={optimaActions().openAIXDebugger}>
            <ListItemDecorator><TerminalOutlinedIcon /></ListItemDecorator>
            AI Inspector
          </MenuItem>
          <MenuItem disabled={!scratchClipSupported()} onClick={toggleScratchClipVisibility}>
            <ListItemDecorator><HistoryIcon /></ListItemDecorator>
            {isScratchClipVisible ? 'Hide ' : ''}Clipboard {scratchClipSupported() ? 'History' : '(not supported)'}
          </MenuItem>
          <ListDivider />

          {/* SUPPORT Section */}
          <ListItem>
            <Typography level="body-xs" sx={{ textTransform: 'uppercase', fontWeight: 600 }}>
              Support
            </Typography>
          </ListItem>
          <MenuItem component='a' href={BaseProduct.SupportForm()} target='_blank'>
            <ListItemDecorator>🔥</ListItemDecorator>
            <div>
              Improve Big-AGI
              <FormHelperText>AI fixes what you report</FormHelperText>
            </div>
            <ArrowOutwardRoundedIcon sx={{ ml: 'auto' }} />
          </MenuItem>
          {!!releaseNotesUrl && (
            <MenuItem onClick={handleShowReleaseNotes}>
              <ListItemDecorator>
                <FeatureBadge featureKey='nav-quick-menu' active={releaseNotesShown}>
                  <CodeIcon />
                </FeatureBadge>
              </ListItemDecorator>
              Release Notes
            </MenuItem>
          )}
          <MenuItem onClick={handleShowTechnologies}>
            {/*<ListItemDecorator><BuildCircleOutlinedIcon /></ListItemDecorator>*/}
            <ListItemDecorator />
            Build Info
          </MenuItem>

        </Menu>
      </Dropdown>);

    return components;
  }, [toggleScratchClipVisibility, isScratchClipVisible, releaseNotesUrl, handleShowReleaseNotes, releaseNotesShown, handleShowTechnologies, props.currentApp, isDrawerOpen]);


  // External link items
  const navExtLinkItems = React.useMemo(() => {
    return navItems.links.map((item, index) =>
      <BringTheLove
        key={'nav-ext-' + item.name}
        asIcon
        text={item.name}
        icon={item.icon}
        link={item.href}
        sx={{
          p: 1,
          mb: index > 0 ? 1 : 0,
        }}
      />,
    );
  }, []);


  // Modal items
  const navModalItems = React.useMemo(() => {
    return navItems.modals.map(item => {

      // map the overlayId to the corresponding state and action
      const stateActionMap: { [key: string]: { isActive: boolean, showModal: (event: React.MouseEvent) => void } } = {
        settings: { isActive: showPreferences, showModal: () => optimaOpenPreferences(/* avoid passing an event as param */) },
        models: { isActive: showModels, showModal: () => optimaOpenModels() },
        0: { isActive: false, showModal: () => console.log('Action missing for ', item.overlayId) },
      };
      const { isActive, showModal } = stateActionMap[item.overlayId] ?? stateActionMap[0];

      // attract the attention to the models configuration when no LLMs are available (a bit hardcoded here)
      const isAttractive = noLLMs && item.overlayId === 'models';

      // skip the models configuration, unless it is required
      if (item.overlayId === 'models' && !isAttractive) return null;

      return (
        <Tooltip key={'n-m-' + item.overlayId} title={isAttractive ? 'Add Language Models - REQUIRED' : item.name}>
          <DesktopNavIcon
            variant={isActive ? 'soft' : undefined}
            onClick={showModal}
            className={`${navItemClasses.typeLinkOrModal} ${isActive ? navItemClasses.active : ''} ${isAttractive ? navItemClasses.attractive : ''}`}
          >
            {(isActive && item.iconActive) ? <item.iconActive /> : <item.icon />}
          </DesktopNavIcon>
        </Tooltip>
      );
    }).filter(component => !!component); // filter out null components
  }, [noLLMs, showModels, showPreferences]);


  return (
    <InvertedBar
      id='desktop-nav'
      component={props.component}
      direction='vertical'
      sx={desktopNavBarSx}
      onMouseEnter={appUsesDrawer ? peekDrawerEnter : undefined}
      onMouseLeave={peekDrawerLeave}
    >

      <InvertedBarCornerItem>
        <Tooltip disableInteractive title={isDrawerPeeking ? 'Pin Drawer' : (isDrawerOpen ? 'Close Drawer' /* for Aria reasons */ : 'Open Drawer')}>
          <DesktopNavIcon
            disabled={!logoButtonTogglesPane}
            onPointerDown={logoButtonTogglesPane ? optimaToggleDrawer : undefined}
            className={navItemClasses.typeMenu}
          >
            {logoButtonTogglesPane ? (isDrawerPeeking ? <PushPinOutlinedIcon sx={{ fontSize: 'xl', transform: 'rotate(45deg)' }} /> : <MenuIcon />) : <BigAgiSquircleIcon inverted sx={{ color: 'white' }} />}
          </DesktopNavIcon>
        </Tooltip>
      </InvertedBarCornerItem>

      <DesktopNavGroupBox>
        {navAppItems}
      </DesktopNavGroupBox>

      <DesktopNavGroupBox sx={bottomGroupSx}>
        {/*<UserNavIcon />*/}
        {navExtLinkItems}
        {navModalItems}
      </DesktopNavGroupBox>

    </InvertedBar>
  );
}