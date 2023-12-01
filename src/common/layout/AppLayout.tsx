import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Box, Container } from '@mui/joy';

import { ModelsModal } from '../../apps/models-modal/ModelsModal';
import { SettingsModal } from '../../apps/settings-modal/SettingsModal';
import { ShortcutsModal } from '../../apps/settings-modal/ShortcutsModal';

import { isPwa } from '~/common/util/pwaUtils';
import { useAppStateStore } from '~/common/state/store-appstate';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { AppBar } from './AppBar';
import { GlobalShortcutItem, useGlobalShortcuts } from '../components/useGlobalShortcut';
import { NoSSR } from '../components/NoSSR';
import { openLayoutModelsSetup, openLayoutPreferences, openLayoutShortcuts } from './store-applayout';


export function AppLayout(props: {
  noAppBar?: boolean, suspendAutoModelsSetup?: boolean,
  children: React.ReactNode,
}) {
  // external state
  const { centerMode } = useUIPreferencesStore(state => ({ centerMode: isPwa() ? 'full' : state.centerMode }), shallow);

  // usage counter, for progressive disclosure of features
  useAppStateStore(state => state.usageCount);

  // global shortcuts for modals
  const shortcuts = React.useMemo((): GlobalShortcutItem[] => [
    ['m', true, true, false, openLayoutModelsSetup],
    ['p', true, true, false, openLayoutPreferences],
    ['?', true, true, false, openLayoutShortcuts],
  ], []);
  useGlobalShortcuts(shortcuts);

  return (
    // Global NoSSR wrapper: the overall Container could have hydration issues when using localStorage and non-default maxWidth
    <NoSSR>

      <Container
        disableGutters
        maxWidth={centerMode === 'full' ? false : centerMode === 'narrow' ? 'md' : 'xl'}
        sx={{
          boxShadow: {
            xs: 'none',
            md: centerMode === 'narrow' ? 'md' : 'none',
            xl: centerMode !== 'full' ? 'lg' : 'none',
          },
        }}>

        <Box sx={{
          display: 'flex', flexDirection: 'column',
          height: '100dvh',
        }}>

          {!props.noAppBar && <AppBar sx={{
            zIndex: 20, // position: 'sticky', top: 0,
          }} />}

          {props.children}

        </Box>

      </Container>

      {/* Overlay Settings */}
      <SettingsModal />

      {/* Overlay Models (& Model Options )*/}
      <ModelsModal suspendAutoModelsSetup={props.suspendAutoModelsSetup} />

      {/* Overlay Shortcuts */}
      <ShortcutsModal />

    </NoSSR>
  );
}