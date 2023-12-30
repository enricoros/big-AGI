import * as React from 'react';
import { PanelResizeHandle } from 'react-resizable-panels';

import { Box } from '@mui/joy';

import { themeBgApp } from '~/common/app.theme';


export function GoodPanelResizeHandler() {
  return (
    <PanelResizeHandle>
      <Box sx={{
        backgroundColor: themeBgApp,
        height: '100%',
        width: '4px',
        '&:hover': {
          backgroundColor: 'primary.softActiveBg',
        },
      }} />
    </PanelResizeHandle>
  );
}