import * as React from 'react';
import Router from 'next/router';

import { Box, IconButton, styled, Tooltip } from '@mui/joy';
import MenuIcon from '@mui/icons-material/Menu';

import { useModelsStore } from '~/modules/llms/store-llms';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { NavItemApp, navItems } from '~/common/app.nav';
import { cssRainbowColorKeyframes, themeZIndexDesktopNav } from '~/common/app.theme';

import { InvertedBar, InvertedBarCornerItem } from './components/InvertedBar';
import { useOptimaDrawers } from './useOptimaDrawers';
import { useOptimaLayout } from './useOptimaLayout';

import { BringTheLove } from '~/common/layout/optima/components/BringTheLove';


// Nav Group

const DesktopNavGroupButton = styled(Box)({
  // flex column
  display: 'flex',
  flexDirection: 'column',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',

  // nav items, reduce the marginBlock a little
  '--GroupMarginY': '0.125rem',

  // style
  // backgroundColor: 'rgba(0 0 0 / 0.5)',
  // borderRadius: '1rem',
  // paddingBlock: '0.5rem',
  // overflow: 'hidden',
});


// Nav Item

const navItemClasses = {
  active: 'NavButton-active',
  paneOpen: 'NavButton-paneOpen',
  attractive: 'NavButton-attractive',
};

const DesktopNavItem = styled(IconButton)(({ theme }) => ({
  // --Bar is defined in InvertedBar
  '--MarginX': '0.25rem',

  // IconButton customization: the objective is to have a square button, with a smaller group margin,
  // and with the nice little animation on pane open and hover
  '--IconButton-size': 'calc(var(--Bar) - 2 * var(--MarginX))',
  '--Icon-fontSize': '1.5rem',
  // border: '1px solid red',
  borderRadius: 'calc(var(--IconButton-size) / 2)',
  marginBlock: 'var(--GroupMarginY)',
  //marginInline: .. not needd because we center the items
  padding: 0,
  transition: 'border-radius 0.4s, margin 0.2s, padding 0.2s',

  [`&:hover`]: {
    // backgroundColor: theme.palette.primary.softHoverBg,
  },

  // pane open: show a connected half
  [`&.${navItemClasses.paneOpen}`]: {
    // squircle animation
    borderStartEndRadius: 0,
    borderEndEndRadius: 0,
    marginLeft: 'calc(2 * var(--MarginX))',
    paddingRight: 'calc(2 * var(--MarginX))',
  },
  [`&.${navItemClasses.paneOpen}:hover`]: {
    borderRadius: 'calc(var(--IconButton-size) / 2)',
    marginLeft: 0,
    paddingRight: 0,
  },

  // attractive: attract the user to click on this element
  [`&.${navItemClasses.attractive}`]: {
    animation: `${cssRainbowColorKeyframes} 5s infinite`,
    transform: 'scale(1.4)',
  },

}));


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
          <DesktopNavItem
            disabled={isNotForUser}
            variant={isActive ? 'soft' : undefined}
            onClick={isPanelable ? toggleDrawer : () => Router.push(item.route)}
            className={`${isActive ? navItemClasses.active : ''} ${isPaneOpen ? navItemClasses.paneOpen : ''}`}
          >
            <item.icon />
          </DesktopNavItem>
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
          <DesktopNavItem
            variant={isActive ? 'soft' : undefined}
            onClick={showModal}
            className={`${isActive ? navItemClasses.active : ''} ${isAttractive ? navItemClasses.attractive : ''}`}
          >
            <item.icon />
          </DesktopNavItem>
        </Tooltip>
      );
    });
  }, [noLLMs, openModelsSetup, openPreferencesTab, showModelsSetup, showPreferencesTab]);


  return (
    <InvertedBar id='desktop-nav' direction='vertical' sx={{ zIndex: themeZIndexDesktopNav }}>

      <InvertedBarCornerItem>
        <Tooltip title={isDrawerOpen ? 'Close' : 'Open Drawer'}>
          <DesktopNavItem disabled={!logoButtonTogglesPane} onClick={handleLogoButtonClick}>
            {logoButtonTogglesPane ? <MenuIcon /> : <AgiSquircleIcon inverted sx={{ color: 'white' }} />}
          </DesktopNavItem>
        </Tooltip>
      </InvertedBarCornerItem>

      <DesktopNavGroupButton>
        {navAppItems}
      </DesktopNavGroupButton>

      <DesktopNavGroupButton>
        {navExtLinkItems}
        {navModalItems}
      </DesktopNavGroupButton>

    </InvertedBar>
  );
}