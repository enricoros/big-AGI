import * as React from 'react';

import { Box, Container } from '@mui/joy';

import { ModelsModal } from '~/modules/llms/models-modal/ModelsModal';
import { SettingsModal } from '../../../apps/settings-modal/SettingsModal';
import { ShortcutsModal } from '../../../apps/settings-modal/ShortcutsModal';

import { isPwa } from '~/common/util/pwaUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { AppBar } from './AppBar';
import { NextRouterProgress } from './NextLoadProgress';
import { useOptimaLayout } from './useOptimaLayout';


export function OptimaLayout(props: {
  noAppBar?: boolean, suspendAutoModelsSetup?: boolean,
  children: React.ReactNode,
}) {

  // external state
  const { closeShortcuts, showShortcuts } = useOptimaLayout();

  const centerMode = useUIPreferencesStore(state => isPwa() ? 'full' : state.centerMode);

  return <>

    <NextRouterProgress color='var(--joy-palette-neutral-700, #32383E)' />

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
    {showShortcuts && <ShortcutsModal onClose={closeShortcuts} />}

  </>;
}