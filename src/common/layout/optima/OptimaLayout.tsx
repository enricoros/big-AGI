import * as React from 'react';

import { Box, Container } from '@mui/joy';

import { ModelsModal } from '~/modules/llms/models-modal/ModelsModal';
import { SettingsModal } from '../../../apps/settings-modal/SettingsModal';
import { ShortcutsModal } from '../../../apps/settings-modal/ShortcutsModal';

import { isPwa } from '~/common/util/pwaUtils';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { AppBar } from './AppBar';
import { NextRouterProgress } from './NextLoadProgress';
import { useOptimaLayout } from './useOptimaLayout';


/*function ResponsiveNavigation() {
  return <>
    <Drawer
      open={false}
      variant='solid'
      anchor='left'
      onClose={() => {
      }}
      sx={{
        '& .MuiDrawer-paper': {
          width: 256,
          boxSizing: 'border-box',
        },
      }}
    >
      <Box sx={{ width: 256, height: '100%' }}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ flexGrow: 1 }} />
        </Box>
      </Box>
    </Drawer>
  </>;
}*/


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
  const isMobile = useIsMobile();

  let centerMode = useUIPreferencesStore(state => (isPwa() || isMobile) ? 'full' : state.centerMode);

  const {
    closePreferences, closeShortcuts,
    openShortcuts,
    showPreferencesTab, showShortcuts,
  } = useOptimaLayout();

  return <>

    {/*<Box sx={{*/}
    {/*  display: 'flex', flexDirection: 'row',*/}
    {/*  maxWidth: '100%', flexWrap: 'nowrap',*/}
    {/*  // overflowX: 'hidden',*/}
    {/*  background: 'lime',*/}
    {/*}}>*/}

    {/*<Box sx={{ background: 'rgba(100 0 0 / 0.5)' }}>a</Box>*/}

    {/*<ResponsiveNavigation />*/}

    <Container
      disableGutters
      maxWidth={centerMode === 'full' ? false : centerMode === 'narrow' ? 'md' : 'xl'}
      sx={{
        // minWidth: 0,
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

        {/* Children must make the assumption they're in a flex-col layout */}
        {props.children}

      </Box>

    </Container>

    {/*<Box sx={{ background: 'rgba(100 0 0 / 0.5)' }}>bb</Box>*/}

    {/*</Box>*/}


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