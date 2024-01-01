import * as React from 'react';

import { Box, Container } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';
import { isPwa } from '~/common/util/pwaUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { MobileNav } from './MobileNav';
import { PageBar } from './PageBar';


/**
 * Loaded Application component, fromt the NextJS page router, wrapped in a Container for centering.
 */
export function PageContainer(props: { currentApp?: NavItemApp, isMobile?: boolean, children: React.ReactNode }) {

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

        {/* Responsive page bar (pluggable App Center Items and App Menu) */}
        <PageBar
          currentApp={props.currentApp}
          isMobile={props.isMobile}
          sx={{
            zIndex: 20,
          }}
        />

        {/* Page (NextJS) must make the assumption they're in a flex-col layout */}
        {props.children}

        {/* [Mobile] Nav bar at the bottom */}
        {/* FIXME: TEMP: Disable mobilenav */}
        {/*{props.isMobile && <MobileNav hideOnFocusMode currentApp={props.currentApp} />}*/}

      </Box>
    </Container>
  );
}