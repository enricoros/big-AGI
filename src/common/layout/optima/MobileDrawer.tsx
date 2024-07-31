import * as React from 'react';

import { Box, Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { optimaCloseDrawer, useOptimaDrawerOpen } from './useOptima';
import { useOptimaPortalOutRef } from './portals/useOptimaPortalOutRef';


function DrawerContentPortal() {
  const drawerPortalRef = useOptimaPortalOutRef('optima-portal-drawer', 'MobileDrawer');
  return (
    <Box
      ref={drawerPortalRef}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    />
  );
}

export function MobileDrawer(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // external state
  const isDrawerOpen = useOptimaDrawerOpen();

  return (
    <Drawer
      id='mobile-drawer'
      component={props.component}
      open={isDrawerOpen}
      onClose={optimaCloseDrawer}
      sx={{
        '--Drawer-horizontalSize': 'clamp(var(--AGI-Drawer-width), 30%, 100%)',
        '--Drawer-transitionDuration': '0.2s',
        // '& .MuiDrawer-paper': {
        //   width: 256,
        //   boxSizing: 'border-box',
        // },
      }}
      slotProps={{
        content: {
          sx: {
            // style: round the right drawer corners
            backgroundColor: 'transparent',
            borderTopRightRadius: 'var(--AGI-Optima-Radius)',
            borderBottomRightRadius: 'var(--AGI-Optima-Radius)',
          },
        },
      }}
    >

      <DrawerContentPortal />

    </Drawer>
  );
}
