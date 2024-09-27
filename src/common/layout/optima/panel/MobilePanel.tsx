import * as React from 'react';

import { Box, Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { optimaClosePanel, useOptimaPanelOpen } from '../useOptima';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';
import { MobileNavListItem } from '~/common/layout/optima/nav/MobileNavListItem';


function PanelContentPortal() {
  const panelPortalRef = useOptimaPortalOutRef('optima-portal-panel', 'MobilePanel');
  return (
    <Box
      ref={panelPortalRef}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    />
  );
}

export function MobilePanel(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // external state
  const isPanelOpen = useOptimaPanelOpen();

  // NOTE on `disableEnforceFocus`: see MobileDrawer
  return (
    <Drawer
      id='mobile-panel'
      component={props.component}
      disableEnforceFocus
      anchor='right'
      open={isPanelOpen}
      onClose={optimaClosePanel}
      sx={{
        '--Drawer-horizontalSize': 'clamp(var(--AGI-Panel-width), 30%, 100%)',
        '--Drawer-transitionDuration': '0.2s',
        // '& .MuiDrawer-paper': {
        //   width: 256,
        //   boxSizing: 'border-box',
        // },
      }}
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'none',
          },
        },
        content: {
          sx: {
            // style: round the right drawer corners
            // backgroundColor: 'transparent',
            borderTopLeftRadius: 'var(--AGI-Optima-Radius)',
            borderBottomLeftRadius: 'var(--AGI-Optima-Radius)',
          },
        },
      }}
    >

      <PanelContentPortal />

      {/*<ListDivider sx={{ mb: 0 }} />*/}
      <MobileNavListItem variant='solid' currentApp={props.currentApp} />

    </Drawer>
  );
}
