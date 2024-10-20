import * as React from 'react';
import Router from 'next/router';

import type { SxProps } from '@mui/joy/styles/types';
import { Divider, Dropdown, ListItemDecorator, Menu, MenuButton, MenuItem, Tooltip } from '@mui/joy';
import MenuIcon from '@mui/icons-material/Menu';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';
import { themeZIndexDesktopNav } from '~/common/app.theme';
import { useHasLLMs } from '~/common/stores/llms/llms.hooks';

import { BringTheLove } from './BringTheLove';
import { DesktopNavGroupBox, DesktopNavIcon, navItemClasses } from './DesktopNavIcon';
import { InvertedBar, InvertedBarCornerItem } from '../InvertedBar';
import { optimaOpenModels, optimaOpenPreferences, optimaToggleDrawer, useOptimaDrawerOpen, useOptimaModelsModalsState } from '../useOptima';


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

  // external state
  const isDrawerOpen = useOptimaDrawerOpen();
  const { showModels, showPreferences } = useOptimaModelsModalsState();
  const noLLMs = !useHasLLMs();


  // show/hide the pane when clicking on the logo
  const appUsesDrawer = !props.currentApp?.hideDrawer;
  const logoButtonTogglesPane = (appUsesDrawer && !isDrawerOpen) || isDrawerOpen;


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
        return <Divider key={'app-sep-' + appIdx} sx={navItemsDividerSx} />;

      return (
        <Tooltip key={'n-m-' + app.route.slice(1)} disableInteractive enterDelay={600} title={app.name + (app.isDev ? ' [DEV]' : '')}>
          <DesktopNavIcon
            variant={isActive ? 'solid' : undefined}
            onPointerDown={isDrawerable ? optimaToggleDrawer : () => Router.push(app.landingRoute || app.route)}
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
          <Menu
            variant='outlined'
            placement='right-start'
            popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [0, -2] } }] }}
            sx={{ minWidth: 220 }}
          >
            {overflowApps.map((app, appIdx) =>
              <MenuItem key={'nav-app-extra-' + appIdx} onClick={() => Router.push(app.landingRoute || app.route)}>
                <ListItemDecorator>
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
  }, [isDrawerOpen, props.currentApp]);


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
  }, [noLLMs, showModels, showPreferences]);


  return (
    <InvertedBar
      id='desktop-nav'
      component={props.component}
      direction='vertical'
      sx={desktopNavBarSx}
    >

      <InvertedBarCornerItem>
        <Tooltip disableInteractive title={isDrawerOpen ? 'Close Drawer' /* for Aria reasons */ : 'Open Drawer'}>
          <DesktopNavIcon
            disabled={!logoButtonTogglesPane}
            onPointerDown={logoButtonTogglesPane ? optimaToggleDrawer : undefined}
            className={navItemClasses.typeMenu}
          >
            {logoButtonTogglesPane ? <MenuIcon /> : <AgiSquircleIcon inverted sx={{ color: 'white' }} />}
          </DesktopNavIcon>
        </Tooltip>
      </InvertedBarCornerItem>

      <DesktopNavGroupBox>
        {navAppItems}
      </DesktopNavGroupBox>

      <DesktopNavGroupBox sx={bottomGroupSx}>
        {navExtLinkItems}
        {navModalItems}
      </DesktopNavGroupBox>

    </InvertedBar>
  );
}