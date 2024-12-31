import * as React from 'react';
import Router from 'next/router';

import { Box, Button, ButtonGroup, Sheet } from '@mui/joy';

import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';
import { BringTheLove } from './BringTheLove';


import { navigateToNews } from '~/common/app.routes';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';

/**
 * This is used from the Menu of the Pagebar, to have nav items on Mobile, before we add
 * a dedicated Mobile Navigation bar.
 */
export function MobileNavItems(props: { currentApp?: NavItemApp }) {

  // group apps into visible (rendered as of now) and overflow (rendered with a dropdown menu)
  let crossedDivider = false;
  const visibleApps: NavItemApp[] = [];
  // const overflowApps: NavItemApp[] = [];

  navItems.apps.forEach((app) => {
    if (!checkVisibileIcon(app, false, props.currentApp)) return;
    if (checkDivider(app)) {
      crossedDivider = true;
      return;
    }
    if (!crossedDivider)
      visibleApps.push(app);
    // else overflowApps.push(app);
  });

  return (

    <Sheet variant='solid' invertedColors sx={{
      display: 'grid',
      gap: 1,
      p: 1,
    }}>

      {/* Group 1: Apps */}
      <ButtonGroup
        component='nav'
        variant='plain'
        sx={{
          '--ButtonGroup-separatorSize': 0,
          '--ButtonGroup-connected': 0,
          gap: 1,
          justifyContent: 'center',
          '& .MuiButton-startDecorator': { mx: 'auto', py: 0.5 },
        }}
      >
        {visibleApps.map((app) => {
          const isActive = app === props.currentApp;
          return (
            <Button
              key={'app-' + app.name}
              size='sm'
              variant={isActive ? 'solid' : undefined}
              onClick={() => Router.push(app.landingRoute || app.route)}
              sx={{ flexDirection: 'column', gap: 0, minWidth: 80, py: 1 }}
              startDecorator={(isActive && app.iconActive) ? <app.iconActive /> : <app.icon />}
            >
              {app.name}
            </Button>
          );
        })}
      </ButtonGroup>

      {/* Group 2: Modals & Social Links */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        gap: 1,
      }}>
        <Button
          size='sm'
          color='neutral'
          variant={props.currentApp?.route === '/news' ? 'solid' : 'plain'}
          onClick={() => navigateToNews()}
          sx={{ minWidth: 80 }}
        >
          News
        </Button>

        {/* HARDCODED: Models */}
        <Button
          size='sm'
          color='neutral'
          variant='plain'
          onClick={optimaOpenModels}
          sx={{ minWidth: 80 }}
        >
          Models
        </Button>

        {/* HARDCODED: Discord */}
        <BringTheLove
          text={navItems.links[0].name}
          icon={navItems.links[0].icon}
          link={navItems.links[0].href}
          sx={{ color: 'text.primary', px: 0, minWidth: 80 }}
        />
      </Box>

    </Sheet>

  );
}