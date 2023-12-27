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


/**
 * Core layout of big-AGI, used by all the Primary applications therein.
 *
 * Main functions:
 *  - modern responsive layout
 *  - core layout of the application, with the Nav, Panes, Appbar, etc.
 *    - the child(ren) of this layout are placed in the main content area
 *  - allows for pluggable components of children applications, via usePluggableOptimaLayout
 *  - overlays and displays various modals
 *  - flicker free
 */
export function OptimaLayout(props: { suspendAutoModelsSetup?: boolean, children: React.ReactNode, }) {

  // external state
  const {
    closePreferences, closeShortcuts,
    openShortcuts,
    showPreferencesTab, showShortcuts,
  } = useOptimaLayout();

  const centerMode = useUIPreferencesStore(state => isPwa() ? 'full' : state.centerMode);


  return <>


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

        <AppBar sx={{
          zIndex: 20,
        }} />

        {props.children}

      </Box>

    </Container>


    {/* Overlay Settings */}
    <SettingsModal open={!!showPreferencesTab} tabIndex={showPreferencesTab} onClose={closePreferences} onOpenShortcuts={openShortcuts} />

    {/* Overlay Models + LLM Options */}
    <ModelsModal suspendAutoModelsSetup={props.suspendAutoModelsSetup} />

    {/* Overlay Shortcuts */}
    {showShortcuts && <ShortcutsModal onClose={closeShortcuts} />}


    {/* Route loading progress overlay */}
    <NextRouterProgress color='var(--joy-palette-neutral-700, #32383E)' />

  </>;
}