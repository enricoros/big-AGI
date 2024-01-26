import * as React from 'react';
import Router from 'next/router';

import { Button, ButtonGroup, Divider, ListItem, Tooltip, VariantProp } from '@mui/joy';

import { checkDivider, checkVisibileIcon, NavItemApp, navItems } from '~/common/app.nav';

import { BringTheLove } from './components/BringTheLove';


/**
 * This is used from the Menu of the Pagebar, to have nav items on Mobile, before we add
 * a dedicated Mobile Navigation bar.
 */
export function MobileNavListItem(props: { variant?: VariantProp, currentApp?: NavItemApp, hideApps?: boolean, hideSocial?: boolean }) {

  return (
    <ListItem
      variant={props.variant}
      sx={{
        '--ListItem-minHeight': 'var(--AGI-Nav-width)',
        gap: 1,
      }}
    >

      {/* Group 1: Apps */}
      {!props.hideApps && (
        <ButtonGroup
          component='nav'
          variant={props.variant}
          sx={{
            '--ButtonGroup-separatorSize': 0,
            '--ButtonGroup-connected': 0,
            gap: 1,
          }}
        >
          {navItems.apps
            .filter(app => checkVisibileIcon(app, true, undefined))
            .map((app) => {
              const isActive = app === props.currentApp;

              if (checkDivider(app))
                return null;
              // return <Divider orientation='vertical' key={'div-' + appIdx} />;

              return (
                <Tooltip key={'n-m-' + app.route.slice(1)} disableInteractive enterDelay={600} title={app.name}>
                  <Button
                    key={'app-' + app.name}
                    size='sm'
                    variant={isActive ? 'soft' : 'solid'}
                    onClick={() => Router.push(app.landingRoute || app.route)}
                  >
                    {/*{isActive ? app.name : <app.icon />}*/}
                    {(isActive && app.name.length <= 4) ? app.name : <app.icon />}
                    {/*{(isActive && app.iconActive) ? <app.iconActive /> : <app.icon />}*/}
                  </Button>
                </Tooltip>
              );
            })}
        </ButtonGroup>
      )}

      {!props.hideApps && <Divider orientation='vertical' sx={{ my: 1.25 }} />}

      {/* Group 2: Social Links */}
      {!props.hideSocial && (
        <ButtonGroup
          variant={props.variant}
          size='sm'
          sx={{
            '--ButtonGroup-separatorSize': 0,
            '--ButtonGroup-connected': 0,
            ml: 'auto',
            gap: 0.5,
          }}
        >
          {navItems.links.map(item =>
            <BringTheLove key={'love-' + item.name} text={item.name} icon={item.icon} link={item.href} />,
          )}
        </ButtonGroup>
      )}

    </ListItem>
  );
}