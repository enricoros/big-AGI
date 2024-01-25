import * as React from 'react';
import Router from 'next/router';

import type { SxProps } from '@mui/joy/styles/types';

import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';

import { InvertedBar } from './components/InvertedBar';
import { MobileNavGroupBox, MobileNavIcon, mobileNavItemClasses } from './components/MobileNavIcon';


export function MobileNav(props: {
  component: React.ElementType,
  currentApp?: NavItemApp,
  hideOnFocusMode?: boolean,
  sx?: SxProps,
}) {

  // external state
  // const { isFocusedMode } = useOptimaLayout();


  // App items
  const navAppItems = React.useMemo(() => {
    return navItems.apps
      .filter(app => checkVisibileIcon(app, true, undefined))
      .map((app) => {
        const isActive = app === props.currentApp;

        if (checkDivider(app)) {
          // return <Divider key={'div-' + appIdx} sx={{ mx: 1, height: '50%', my: 'auto' }} />;
          return null;
        }

        return (
          <MobileNavIcon
            key={'n-m-' + app.route.slice(1)}
            aria-label={app.name}
            variant={isActive ? 'solid' : undefined}
            onClick={() => Router.push(app.landingRoute || app.route)}
            className={`${mobileNavItemClasses.typeApp} ${isActive ? mobileNavItemClasses.active : ''}`}
          >
            {/*{(isActive && app.iconActive) ? <app.iconActive /> : <app.icon />}*/}
            <app.icon />
          </MobileNavIcon>
        );
      });
  }, [props.currentApp]);


  // NOTE: this may be abrupt a little
  // if (isFocusedMode && props.hideOnFocusMode)
  //   return null;

  return (
    <InvertedBar
      id='mobile-nav'
      component={props.component}
      direction='horizontal'
      sx={props.sx}
    >

      <MobileNavGroupBox>
        {navAppItems}
      </MobileNavGroupBox>

    </InvertedBar>
  );
}