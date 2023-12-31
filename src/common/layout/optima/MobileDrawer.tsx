import * as React from 'react';

import { Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';
import { useOptimaDrawer } from './useOptimaDrawer';
import { useOptimaLayout } from '~/common/layout/optima/useOptimaLayout';
import { PageDrawer } from '~/common/layout/optima/PageDrawer';


export function MobileDrawer(props: { currentApp?: NavItemApp }) {

  const {
    appPaneContent,
  } = useOptimaLayout();
  const {
    isDrawerOpen, closeDrawer,
  } = useOptimaDrawer();

  return (
    <Drawer
      open={isDrawerOpen}
      onClose={closeDrawer}
      sx={{
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
