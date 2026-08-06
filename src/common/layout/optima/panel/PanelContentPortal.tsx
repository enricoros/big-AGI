import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box } from '@mui/joy';

import { OPTIMA_PANEL_GROUPS_SPACING } from '../optima.config';
import { useOptimaPortalOutRef } from '../portals/useOptimaPortalOutRef';


const portalContentSx: SxProps = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: OPTIMA_PANEL_GROUPS_SPACING,
  // gap: 'var(--ListDivider-gap)'
};


export function PanelContentPortal() {

  // external state
  const panelPortalRef = useOptimaPortalOutRef('optima-portal-panel', 'PanelPortal');

  return <Box ref={panelPortalRef} sx={portalContentSx} />;
}