import * as React from 'react';
import Router from 'next/router';

import { Tooltip } from '@mui/joy';
import MenuIcon from '@mui/icons-material/Menu';

import { useModelsStore } from '~/modules/llms/store-llms';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { NavItemApp, navItems } from '~/common/app.nav';
import { themeZIndexDesktopNav } from '~/common/app.theme';

import { BringTheLove } from './components/BringTheLove';
import { DesktopNavGroupButton, DesktopNavIcon, navItemClasses } from './components/DesktopNavIcon';
import { InvertedBar, InvertedBarCornerItem } from './components/InvertedBar';
import { useOptimaDrawers } from './useOptimaDrawers';
import { useOptimaLayout } from './useOptimaLayout';


// Nav Group


// Nav Item


export function DesktopNav(props: { currentApp?: NavItemApp }) {

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
  const appUsesPane = !!props.currentApp?.drawer;
  const logoButtonTogglesPane = (appUsesPane && !isDrawerOpen) || isDrawerOpen;
  const handleLogoButtonClick = React.useCallback(() => {
    if (logoButtonTogglesPane)
      toggleDrawer();
  }, [logoButtonTogglesPane, toggleDrawer]);


  // App items
  const navAppItems = React.useMemo(() => {
    return navItems.apps.filter(app => !app.hideNav /* .automatic */).map(item => {
      const isActive = item === props.currentApp;
      const isPanelable = isActive && !!item.drawer;
      const isPaneOpen = isPanelable && isDrawerOpen;
      const isNotForUser = !!item.automatic && !isActive;
      return (
        <Tooltip disableInteractive enterDelay={600} key={'n-m-' + item.route.slice(1)} title={item.name}>
          <DesktopNavIcon
            disabled={isNotForUser}
            variant={isActive ? 'soft' : undefined}
            onClick={isPanelable ? toggleDrawer : () => Router.push(item.route)}
            className={`${navItemClasses.typeApp} ${isActive ? navItemClasses.active : ''} ${isPaneOpen ? navItemClasses.paneOpen : ''}`}
          >
            <item.icon />
          </DesktopNavIcon>
        </Tooltip>
      );
    });
  }, [props.currentApp, isDrawerOpen, toggleDrawer]);


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
            <item.icon />
          </DesktopNavIcon>
        </Tooltip>
      );
    });
  }, [noLLMs, openModelsSetup, openPreferencesTab, showModelsSetup, showPreferencesTab]);


  return (
    <InvertedBar id='desktop-nav' direction='vertical' sx={{ zIndex: themeZIndexDesktopNav }}>

      <InvertedBarCornerItem>
        <Tooltip title={isDrawerOpen ? undefined : 'Open Drawer'}>
          <DesktopNavIcon disabled={!logoButtonTogglesPane} onClick={handleLogoButtonClick}>
            {logoButtonTogglesPane ? <MenuIcon /> : <AgiSquircleIcon inverted sx={{ color: 'white' }} />}
          </DesktopNavIcon>
        </Tooltip>
      </InvertedBarCornerItem>

      <DesktopNavGroupButton>
        {navAppItems}
      </DesktopNavGroupButton>

      <DesktopNavGroupButton sx={{ mb: 'calc(2 * var(--GroupMarginY))' }}>
        {navExtLinkItems}
        {navModalItems}
      </DesktopNavGroupButton>

    </InvertedBar>
  );
}