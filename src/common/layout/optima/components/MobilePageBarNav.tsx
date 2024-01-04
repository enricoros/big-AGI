import * as React from 'react';
import Router from 'next/router';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ButtonGroup, ListItem, Tooltip } from '@mui/joy';

import { Link } from '~/common/components/Link';
import { cssRainbowColorKeyframes } from '~/common/app.theme';
import { type NavItemApp, navItems } from '~/common/app.nav';


function BringTheLove(props: { text: string, link: string, icon: React.FC, sx?: SxProps }) {
  // state
  const [loved, setLoved] = React.useState(false);
  const icon = loved ? '❤️' : <props.icon /> ?? null; // '❤️' : '🤍';

  // reset loved after 5 seconds
  React.useEffect(() => {
    if (loved) {
      const timer = setTimeout(() => setLoved(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [loved]);

  return (
    <Tooltip followCursor title={props.text}>
      <Button
        variant='solid' size='md'
        component={Link} noLinkStyle href={props.link} target='_blank'
        onClick={() => setLoved(true)}
        // endDecorator={icon}
        sx={{
          background: 'transparent',
          '&:hover': { animation: `${cssRainbowColorKeyframes} 5s linear infinite` },
          ...props.sx,
        }}
      >
        {/*{props.text || icon}*/}
        {icon}
      </Button>
    </Tooltip>
  );
}


export function MobilePageBarNav(props: { currentApp?: NavItemApp }) {

  // external state
  // const { closePageMenu } = useOptimaDrawers();


  // // switcher
  // const switchApp = (app: ContainedAppType) => {
  //   if (currentApp !== app) {
  //     // closePageMenu();
  //     void routerPush(AppRouteMap[app].route);
  //   }
  // };

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
        {navItems.apps.filter(app => ['Chat', 'News'].includes(app.name)).map(app =>
          <Button
            key={'app-' + app.name}
            disabled={!!app.automatic}
            size='sm'
            variant={app == props.currentApp ? 'soft' : 'solid'}
            onClick={() => Router.push(app.route)}
          >
            {app.name}
          </Button>,
        )}
      </ButtonGroup>

      <Box sx={{ flex: 1 }} />

      {/* Group 2: Social Links */}
      <ButtonGroup
        variant='solid'
        sx={{
          '--ButtonGroup-separatorSize': '0px',
          '--ButtonGroup-connected': '0',
          gap: 0,
        }}
      >
        {navItems.links.map(item =>
          <BringTheLove key={'love-' + item.name} text={item.name} icon={item.icon} link={item.href} />,
        )}
      </ButtonGroup>

    </ListItem>
  );
}