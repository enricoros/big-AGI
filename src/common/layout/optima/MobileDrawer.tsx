import * as React from 'react';

import { Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { useOptimaDrawers } from './useOptimaDrawers';
import { useOptimaLayout } from './useOptimaLayout';


export function MobileDrawer(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // external state
  const { appDrawerContent } = useOptimaLayout();
  const { isDrawerOpen, closeDrawer } = useOptimaDrawers();

  return (
    <Drawer
      id='mobile-drawer'
      component={props.component}
      open={isDrawerOpen}
      onClose={closeDrawer}
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

      {appDrawerContent}

    </Drawer>
  );
}
