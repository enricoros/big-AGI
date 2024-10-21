import * as React from 'react';

import { Box, Drawer, List } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { MobileNavItems } from '../nav/MobileNavItems';
import { PanelContentPortal } from './PanelContentPortal';
import { optimaClosePanel, useOptimaPanelOpen } from '../useOptima';
import { MobilePreferencesListItem } from '~/common/layout/optima/panel/MobilePreferencesListItem';
import { OPTIMA_PANEL_GROUPS_SPACING } from '~/common/layout/optima/panel/OptimaPanelGroupedList';


export function MobilePanel(props: { component: React.ElementType, currentApp?: NavItemApp }) {

  // external state
  const { panelShownAsPanel } = useOptimaPanelOpen(true, props.currentApp);

  // NOTE on `disableEnforceFocus` (Joy UI): see MobileDrawer
  return (
    <Drawer
      id='mobile-panel'
      component={props.component}
      disableEnforceFocus
      anchor='right'
      open={panelShownAsPanel}
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

      {/* Preferences */}
      <Box sx={{ py: 0.25, mb: OPTIMA_PANEL_GROUPS_SPACING }}>
        <List variant='plain'>
          <MobilePreferencesListItem />
        </List>
      </Box>

      {/* [Mobile] Panel within the Drawer -- includes the Preferences Item */}
      <PanelContentPortal />

      {/* [Mobile] Nav Items */}
      <MobileNavItems currentApp={props.currentApp} />

    </Drawer>
  );
}
