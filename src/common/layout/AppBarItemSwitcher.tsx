import * as React from 'react';
import { useRouter } from 'next/router';

import { Box, Button, ButtonGroup, ListItem } from '@mui/joy';

import { BringTheLove } from '~/common/layout/AppBarItemSupport';
import { Brand } from '~/common/brand';

import { setLayoutMenuAnchor } from './store-applayout';


// routes for the quick switcher menu item

type ContainedAppType = 'chat' | 'data' | 'news';

const AppItems: ContainedAppType[] = ['chat', 'news'];

const AppRouteMap: { [key in ContainedAppType]: { name: string, route: string } } = {
  'chat': {
    name: 'Chat',
    route: '/',
  },
  'data': {
    name: 'Data',
    route: '/data',
  },
  'news': {
    name: 'News',
    route: '/news',
  },
};


export function AppBarItemSwitcher() {
  // external state
  const { route, push: routerPush } = useRouter();

  // find the current ContainedAppType or null
  const currentApp: ContainedAppType | null = AppItems.find(app => AppRouteMap[app].route == route) || null;

  // switcher
  const switchApp = (app: ContainedAppType) => {
    if (currentApp !== app) {
      setLayoutMenuAnchor(null);
      routerPush(AppRouteMap[app].route).then(() => null);
    }
  };

  return (
    <ListItem
      variant='solid' color='neutral'
      sx={{
        '--ListItem-minHeight': '52px',
        gap: 1,
      }}
    >
      {/* Group 1: Apps */}
      <ButtonGroup
        variant='solid'
        sx={{
          '--ButtonGroup-separatorSize': '0px',
          '--ButtonGroup-connected': '0',
          gap: 1,
        }}
      >
        {AppItems.map((app: ContainedAppType) => (
          <Button
            key={'app-' + app}
            size='sm' variant={app == currentApp ? 'soft' : 'solid'} color={app == currentApp ? 'primary' : 'neutral'}
            onClick={() => switchApp(app)}
          >
            {AppRouteMap[app].name}
          </Button>
        ))}
      </ButtonGroup>

      <Box sx={{ flex: 1 }} />

      {/* Group 2: Social Links */}
      <ButtonGroup
        variant='solid'
        sx={{
          '--ButtonGroup-separatorSize': '0px',
          '--ButtonGroup-connected': '0',
          gap: 1,
        }}
      >
        <BringTheLove text='Discord' link={Brand.URIs.SupportInvite} />
        <BringTheLove text='GitHub' link={Brand.URIs.OpenRepo} />
      </ButtonGroup>

    </ListItem>
  );
}