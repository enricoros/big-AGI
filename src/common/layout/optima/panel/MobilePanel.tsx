import * as React from 'react';

import { Box, Drawer } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';

import { MobilePreferencesListItem } from './MobilePreferencesListItem';
import { OPTIMA_DRAWER_MOBILE_RADIUS, OPTIMA_PANEL_GROUPS_SPACING } from '../optima.config';
import { OptimaPanelGroupedList } from './OptimaPanelGroupedList';
import { PanelContentPortal } from './PanelContentPortal';
import { optimaClosePanel, useOptimaPanelOpen } from '../useOptima';


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
        '--Drawer-horizontalSize': 'round(clamp(30%, var(--AGI-Mobile-Panel-width), 100%), 1px)',
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
            borderTopLeftRadius: OPTIMA_DRAWER_MOBILE_RADIUS,
            borderBottomLeftRadius: OPTIMA_DRAWER_MOBILE_RADIUS,
          },
        },
      }}
    >

      {/* Preferences */}
      <Box sx={{
        // mb: OPTIMA_PANEL_GROUPS_SPACING,
        // make the [Account, Preferences, Portal] stack scrollable
        height: '100%',
        overflowY: 'auto',
        pb: OPTIMA_PANEL_GROUPS_SPACING,
      }}>

        <Box sx={{ py: 0.25, mb: OPTIMA_PANEL_GROUPS_SPACING }}>
          <OptimaPanelGroupedList>
            <MobilePreferencesListItem />
          </OptimaPanelGroupedList>
        </Box>

        {/* [Mobile] Panel within the Drawer */}
        <PanelContentPortal />

      </Box>


    </Drawer>
  );
}
