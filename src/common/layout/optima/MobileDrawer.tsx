import * as React from 'react';

import { Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { PageDrawer } from './PageDrawer';
import { useOptimaDrawers } from './useOptimaDrawers';
import { useOptimaLayout } from './useOptimaLayout';


export function MobileDrawer(props: { currentApp?: NavItemApp }) {

  // external state
  const { appPaneContent } = useOptimaLayout();
  const { isDrawerOpen, closeDrawer } = useOptimaDrawers();

  return (
    <Drawer
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
    >

      <PageDrawer currentApp={props.currentApp} onClose={closeDrawer}>
        {appPaneContent}
      </PageDrawer>

    </Drawer>
  );
}
