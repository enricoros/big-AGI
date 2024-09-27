import * as React from 'react';

import { Box, Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { optimaCloseDrawer, useOptimaDrawerOpen } from '../useOptima';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';


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

  /* NOTE on `disableEnforceFocus`:
   * This is a workaround for mobile drawer focus issues, when pressing the 3-dot menu button
   * on the `Search...` input field will flash-and-hide the menu.
   *
   * This prop disables the default focus trap behavior of the Drawer.
   * It allows focus to move freely outside the Drawer, which is useful
   * when the Drawer contains components (like Menus) that need to manage
   * their own focus.
   *
   * This prevents unexpected focus resets to the Drawer content when interacting with
   * nested interactive elements.
   *
   * See also `windowUtils.useDocumentFocusDebugger` for debugging focus issues.
   */
  return (
    <Drawer
      id='mobile-drawer'
      component={props.component}
      disableEnforceFocus
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
