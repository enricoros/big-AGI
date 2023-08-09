import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Container, useTheme } from '@mui/joy';

import { ModelsModal } from '../../apps/models-modal/ModelsModal';
import { SettingsModal } from '../../apps/settings-modal/SettingsModal';

import { isPwa } from '~/common/util/pwaUtils';
import { useAppStateStore } from '~/common/state/store-appstate';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { AppBar } from './AppBar';
import { NoSSR } from '../components/NoSSR';


export function AppLayout(props: {
  noAppBar?: boolean, suspendAutoModelsSetup?: boolean,
  children: React.ReactNode,
}) {
  // external state
  const theme = useTheme();
  const { centerMode } = useUIPreferencesStore(state => ({ centerMode: isPwa() ? 'full' : state.centerMode }), shallow);

  // usage counter, for progressive disclosure of features
  // noinspection JSUnusedLocalSymbols
  const usageCount = useAppStateStore(state => state.usageCount);

  return (
    // Global NoSSR wrapper: the overall Container could have hydration issues when using localStorage and non-default maxWidth
    <NoSSR>

      <Container
        disableGutters
        maxWidth={centerMode === 'full' ? false : centerMode === 'narrow' ? 'md' : 'xl'}
        sx={{
          boxShadow: {
            xs: 'none',
            md: centerMode === 'narrow' ? theme.shadow.md : 'none',
            xl: centerMode !== 'full' ? theme.shadow.lg : 'none',
          },
        }}>

        <Box sx={{
          display: 'flex', flexDirection: 'column',
          height: '100dvh',
        }}>

          {!props.noAppBar && <AppBar sx={{
            zIndex: 20, // position: 'sticky', top: 0,
            // ...(process.env.NODE_ENV === 'development' ? { background: theme.palette.danger.solidBg } : {}),
          }} />}

          {props.children}

        </Box>

      </Container>

      <SettingsModal />

      <ModelsModal suspendAutoModelsSetup={props.suspendAutoModelsSetup} />

    </NoSSR>
  );
}