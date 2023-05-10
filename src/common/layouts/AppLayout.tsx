import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Container, useTheme } from '@mui/joy';

import { useSettingsStore } from '@/common/state/store-settings';

import { SettingsModal } from '../../apps/settings/SettingsModal';

import { ApplicationBar } from '../components/appbar/ApplicationBar';
import { NoSSR } from '../components/NoSSR';


export function AppLayout(props: { children: React.ReactNode, noAppBar?: boolean, noSettings?: boolean }) {
  // external state
  const theme = useTheme();
  const { centerMode } = useSettingsStore(state => ({ centerMode: state.centerMode }), shallow);

  return (
    // Global NoSSR wrapper: the overall Container could have hydration issues when using localStorage and non-default maxWidth
    <NoSSR>

      <Container
        disableGutters
        maxWidth={centerMode === 'full' ? false : centerMode === 'narrow' ? 'md' : 'xl'}
        sx={{
          boxShadow: {
            xs: 'none',
            md: centerMode === 'narrow' ? theme.vars.shadow.md : 'none',
            xl: centerMode !== 'full' ? theme.vars.shadow.lg : 'none',
          },
        }}>

        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>

          {!props.noAppBar && <ApplicationBar sx={{
            zIndex: 20, // position: 'sticky', top: 0,
            // ...(process.env.NODE_ENV === 'development' ? { background: theme.vars.palette.danger.solidBg } : {}),
          }} />}

          {props.children}

        </Box>

      </Container>

      {!props.noSettings && <SettingsModal />}

    </NoSSR>
  );
}