import * as React from 'react';
import Router from 'next/router';

import type { SxProps } from '@mui/joy/styles/types';
import { Divider, Dropdown, ListItemDecorator, Menu, MenuButton, MenuItem, Tooltip } from '@mui/joy';
import MenuIcon from '@mui/icons-material/Menu';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

import { useModelsStore } from '~/modules/llms/store-llms';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';
import { themeZIndexDesktopNav } from '~/common/app.theme';

import { BringTheLove } from './components/BringTheLove';
import { DesktopNavGroupBox, DesktopNavIcon, navItemClasses } from './components/DesktopNavIcon';
import { InvertedBar, InvertedBarCornerItem } from './components/InvertedBar';
import { useOptimaDrawers } from './useOptimaDrawers';
import { useOptimaLayout } from './useOptimaLayout';


const desktopNavBarSx: SxProps = {
  zIndex: themeZIndexDesktopNav,
};


export function DesktopNav(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // external state
  const {
    isDrawerOpen, toggleDrawer,
  } = useOptimaDrawers();
  const {
    showPreferencesTab, openPreferencesTab,
    showModelsSetup, openModelsSetup,
  } = useOptimaLayout();
  const noLLMs = useModelsStore(state => !state.llms.length);


  // show/hide the pane when clicking on the logo
  const appUsesDrawer = !props.currentApp?.hideDrawer;
  const logoButtonTogglesPane = (appUsesDrawer && !isDrawerOpen) || isDrawerOpen;
  const handleLogoButtonClick = React.useCallback(() => {
    if (logoButtonTogglesPane)
      toggleDrawer();
  }, [logoButtonTogglesPane, toggleDrawer]);


  // App items
  const navAppItems = React.useMemo(() => {

    // group apps into visible (rendered as of now) and overflow (rendered with a dropdown menu)
    let crossedDivider = false;
    const visibleApps: NavItemApp[] = [];
    const overflowApps: NavItemApp[] = [];

    navItems.apps.forEach((app, index) => {
      if (checkVisibileIcon(app, false, props.currentApp)) {
        if (!crossedDivider || app === props.currentApp)
          visibleApps.push(app);
        else
          overflowApps.push(app);
        crossedDivider = crossedDivider || checkDivider(app);
      }
    });

    // Application buttons (and group sepearator)
    const components: React.JSX.Element[] = visibleApps.map((app, appIdx) => {
      const isActive = app === props.currentApp;
      const isDrawerable = isActive && !app.hideDrawer;
      const isPaneOpen = isDrawerable && isDrawerOpen;

      if (checkDivider(app))
        return <Divider key={'app-sep-' + appIdx} sx={{ my: 1, width: '50%', mx: 'auto' }} />;

      return (
        <Tooltip key={'n-m-' + app.route.slice(1)} disableInteractive enterDelay={600} title={app.name + (app.isDev ? ' [DEV]' : '')}>
          <DesktopNavIcon
            variant={isActive ? 'solid' : undefined}
            onClick={isDrawerable ? toggleDrawer : () => Router.push(app.landingRoute || app.route)}
            className={`${navItemClasses.typeApp} ${isActive ? navItemClasses.active : ''} ${isPaneOpen ? navItemClasses.paneOpen : ''} ${app.isDev ? navItemClasses.dev : ''}`}
          >
            {/*{(isActive && app.iconActive) ? <app.iconActive /> : <app.icon />}*/}
            <app.icon />
          </DesktopNavIcon>
        </Tooltip>
      );
    });

    // Overflow dropdown menu
    if (overflowApps.length) {
      components.push(
        <Dropdown key='n-app-overflow'>
          <Tooltip disableInteractive enterDelay={600} title='More Apps'>
            <MenuButton slots={{ root: DesktopNavIcon }} slotProps={{ root: { className: navItemClasses.typeApp } }}>
              <MoreHorizIcon />
            </MenuButton>
          </Tooltip>
          <Menu variant='solid' invertedColors placement='right-start' sx={{ minWidth: 160 }}>
            {overflowApps.map((app, appIdx) =>
              <MenuItem key={'nav-app-extra-' + appIdx} onClick={() => Router.push(app.landingRoute || app.route)} sx={{ minHeight: '2.5rem' }}>
                <ListItemDecorator sx={{ ml: 1 }}>
                  <app.icon />
                </ListItemDecorator>
                {app.name + (app.isDev ? ' [DEV]' : '')}
              </MenuItem>,
            )}
          </Menu>
        </Dropdown>,
      );
    }
    return components;
  }, [isDrawerOpen, props.currentApp, toggleDrawer]);


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
      const stateActionMap: { [key: string]: { isActive: boolean, showModal: () => void } } = {
        settings: { isActive: !!showPreferencesTab, showModal: () => openPreferencesTab() },
        models: { isActive: showModelsSetup, showModal: openModelsSetup },
        0: { isActive: false, showModal: () => console.log('Action missing for ', item.overlayId) },
      };
      const { isActive, showModal } = stateActionMap[item.overlayId] ?? stateActionMap[0];

      // attract the attention to the models configuration when no LLMs are available (a bit hardcoded here)
      const isAttractive = noLLMs && item.overlayId === 'models';

      return (
        <Tooltip followCursor key={'n-m-' + item.overlayId} title={isAttractive ? 'Add Language Models - REQUIRED' : item.name}>
          <DesktopNavIcon
            variant={isActive ? 'soft' : undefined}
            onClick={showModal}
            className={`${navItemClasses.typeLinkOrModal} ${isActive ? navItemClasses.active : ''} ${isAttractive ? navItemClasses.attractive : ''}`}
          >
            {(isActive && item.iconActive) ? <item.iconActive /> : <item.icon />}
          </DesktopNavIcon>
        </Tooltip>
      );
    });
  }, [noLLMs, openModelsSetup, openPreferencesTab, showModelsSetup, showPreferencesTab]);


  return (
    <InvertedBar
      id='desktop-nav'
      component={props.component}
      direction='vertical'
      sx={desktopNavBarSx}
    >

      <InvertedBarCornerItem>
        <Tooltip title={isDrawerOpen ? 'Close Drawer' /* for Aria reasons */ : 'Open Drawer'}>
          <DesktopNavIcon disabled={!logoButtonTogglesPane} onClick={handleLogoButtonClick} className={navItemClasses.typeMenu}>
            {logoButtonTogglesPane ? <MenuIcon /> : <AgiSquircleIcon inverted sx={{ color: 'white' }} />}
          </DesktopNavIcon>
        </Tooltip>
      </InvertedBarCornerItem>

      <DesktopNavGroupBox>
        {navAppItems}
      </DesktopNavGroupBox>

      <DesktopNavGroupBox sx={{ mb: 'calc(2 * var(--GroupMarginY))' }}>
        {navExtLinkItems}
        {navModalItems}
      </DesktopNavGroupBox>

    </InvertedBar>
  );
}