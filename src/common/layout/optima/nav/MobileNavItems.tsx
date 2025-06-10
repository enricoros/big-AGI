import * as React from 'react';
import Router from 'next/router';

import { Box, Button, ButtonGroup, ColorPaletteProp, Sheet } from '@mui/joy';

import { ROUTE_APP_NEWS } from '~/common/app.routes';
import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';

import { BringTheLove } from './BringTheLove';
import { optimaCloseDrawer, optimaOpenModels } from '../useOptima';


// configuration
const INVERT_PANE = true; // if true, the pane will be darker
const COLOR_PANE: ColorPaletteProp = 'neutral';


const _styles = {

  sheet: {
    // borderTopLeftRadius: OPTIMA_DRAWER_MOBILE_RADIUS,
    // borderTopRightRadius: OPTIMA_DRAWER_MOBILE_RADIUS,
    display: 'grid',
    rowGap: 0.5,
    py: 2,
    ...(INVERT_PANE ? {} : {
      borderTop: '1px solid',
      borderTopColor: 'divider',
    }),
  } as const,

  appsButtonGroup: {
    '--ButtonGroup-separatorSize': 0,
    '--ButtonGroup-connected': 0,
    gap: 1,
    justifyContent: 'center',
    overflowX: 'auto',
  } as const,

  button: {
    minWidth: '5.5rem',
    p: '0.5rem 0 0.375rem',
    borderRadius: 'sm',
    color: INVERT_PANE ? 'text.secondary' : undefined,
    fontWeight: 'sm',
    lineHeight: 'xs',
    '&[aria-selected="true"]': {
      boxShadow: INVERT_PANE ? `inset 1px 1px 3px -2px var(--joy-palette-${COLOR_PANE}-solidBg)` : undefined,
      // backgroundColor: INVERT_PANE ? undefined : 'background.popup',
      color: INVERT_PANE ? 'text.primary' : undefined,
      fontWeight: 'lg',
    },
    // layout
    flexDirection: 'column',
    gap: 0.75,
  } as const,

  linksGroup: {
    display: 'flex',
    justifyContent: 'center',
    gap: 1,
  } as const,

} as const;


/**
 * This can be plugged to the Drawer or Panel, to have nav items on Mobile.
 */
export function MobileNavItems(props: { currentApp?: NavItemApp }) {

  // group apps into visible (rendered as of now) and overflow (rendered with a dropdown menu)
  let crossedDivider = false;
  const visibleApps: NavItemApp[] = [];
  // const overflowApps: NavItemApp[] = [];

  const handleNavigate = React.useCallback((path: string, closeDrawer: boolean = true) => {
    void Router.push(path);
    if (closeDrawer)
      optimaCloseDrawer();
  }, []);

  navItems.apps.forEach((app) => {
    if (!checkVisibileIcon(app, true, props.currentApp)) return;
    if (checkDivider(app)) {
      crossedDivider = true;
      return;
    }
    // NOTE: using the 'hideOnMobile' flag instead of the crossing
    // if (!crossedDivider)
    visibleApps.push(app);
    // else overflowApps.push(app);
  });

  return (

    <Sheet color={COLOR_PANE} variant={INVERT_PANE ? 'solid' : 'soft'} invertedColors={INVERT_PANE} sx={_styles.sheet}>

      {/* Group 1: Apps */}
      <ButtonGroup
        component='nav'
        sx={_styles.appsButtonGroup}
      >
        {visibleApps.map((app) => {
          const isActive = app === props.currentApp;
          return (
            <Button
              key={'app-' + (app.mobileName || app.name)}
              aria-selected={isActive}
              size='sm'
              color={COLOR_PANE}
              variant={isActive ? (INVERT_PANE ? 'soft' : 'solid') : 'plain'}
              onClick={() => handleNavigate(app.landingRoute || app.route, !!app.hideDrawer)}
              sx={_styles.button}
            >
              {(isActive && app.iconActive) ? <app.iconActive /> : <app.icon />}
              <Box component='span'>
                {app.mobileName || app.name}
              </Box>
            </Button>
          );
        })}
      </ButtonGroup>

      {/* Group 2: Modals & Social Links */}
      <Box sx={_styles.linksGroup}>
        <Button
          size='sm'
          color='neutral'
          aria-selected={props.currentApp?.route === '/news'}
          variant={props.currentApp?.route === '/news' ? (INVERT_PANE ? 'soft' : 'solid') : 'plain'}
          onClick={() => handleNavigate(ROUTE_APP_NEWS, true)}
          sx={_styles.button}
        >
          News
        </Button>

        {/* HARDCODED: Models */}
        <Button
          size='sm'
          color='neutral'
          variant='plain'
          onClick={optimaOpenModels}
          sx={_styles.button}
        >
          Models
        </Button>

        {/* HARDCODED: Discord */}
        <BringTheLove
          text={navItems.links[0].name}
          icon={navItems.links[0].icon}
          link={navItems.links[0].href}
          sx={_styles.button}
        />
      </Box>

    </Sheet>

  );
}