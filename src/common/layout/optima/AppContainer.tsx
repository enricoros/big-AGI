import * as React from 'react';

import { Box, Container } from '@mui/joy';

import { isPwa } from '~/common/util/pwaUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { AppBar } from './AppBar';


/**
 * Loaded Application component, fromt the NextJS page router, wrapped in a Container for centering.
 */
export function AppContainer(props: { isMobile?: boolean, children: React.ReactNode }) {

  // external state
  const amplitude = useUIPreferencesStore(state =>
    (isPwa() || props.isMobile) ? 'full' : state.centerMode,
  );

  return (
    <Container
      disableGutters
      maxWidth={amplitude === 'full' ? false : amplitude === 'narrow' ? 'md' : 'xl'}
      sx={{
        // minWidth: 0,
        boxShadow: {
          xs: 'none',
          md: amplitude === 'narrow' ? 'md' : 'none',
          xl: amplitude !== 'full' ? 'lg' : 'none',
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
  );
}