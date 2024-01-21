import * as React from 'react';
import Router from 'next/router';
import { Button, ButtonGroup, ListItem } from '@mui/joy';

import { NavItemApp, navItems } from '~/common/app.nav';

import { BringTheLove } from './components/BringTheLove';


export function MobileNavListItem(props: { currentApp?: NavItemApp }) {

  return (
    <ListItem
      variant='solid'
      sx={{
        '--ListItem-minHeight': 'var(--AGI-Nav-width)',
        gap: 1,
      }}
    >

      {/* Group 1: Apps */}
      <ButtonGroup
        variant='solid'
        sx={{
          '--ButtonGroup-separatorSize': 0,
          '--ButtonGroup-connected': 0,
          gap: 1,
        }}
      >
        {navItems.apps.filter(app => !app.hideOnMobile && !app.hideNav).map(app =>
          <Button
            key={'app-' + app.name}
            disabled={!!app.automatic}
            size='sm'
            variant={app == props.currentApp ? 'soft' : 'solid'}
            onClick={() => Router.push(app.route)}
          >
            {app == props.currentApp ? app.name : <app.icon />}
          </Button>,
        )}
      </ButtonGroup>

      {/* Group 2: Social Links */}
      <ButtonGroup
        variant='solid'
        sx={{
          '--ButtonGroup-separatorSize': 0,
          '--ButtonGroup-connected': 0,
          ml: 'auto',
        }}
      >
        {navItems.links.map(item =>
          <BringTheLove key={'love-' + item.name} text={item.name} icon={item.icon} link={item.href} />,
        )}
      </ButtonGroup>

    </ListItem>
  );
}