import * as React from 'react';

import { Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { PageDrawer } from './PageDrawer';
import { useOptimaDrawers } from './useOptimaDrawers';
import { useOptimaLayout } from './useOptimaLayout';


export function MobileDrawer(props: { currentApp?: NavItemApp }) {

  const {
    appPaneContent,
  } = useOptimaLayout();
  const {
    isDrawerOpen, closeDrawer,
  } = useOptimaDrawers();

  return (
    <Drawer
      open={isDrawerOpen}
      onClose={closeDrawer}
      sx={{
        '--Drawer-horizontalSize': 'clamp(var(--Agi-drawer-width), 30%, 100%)',
        // '& .MuiDrawer-paper': {
        //   width: 256,
        //   boxSizing: 'border-box',
        // },
      }}
    >

      <PageDrawer currentApp={props.currentApp} onClick={closeDrawer}>
        {appPaneContent}
      </PageDrawer>

    </Drawer>
  );
}
