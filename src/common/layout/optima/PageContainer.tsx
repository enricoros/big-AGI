import * as React from 'react';

import { Box, Container } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';
import { isPwa } from '~/common/util/pwaUtils';
import { themeZIndexPageBar } from '~/common/app.theme';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { PageBar } from './PageBar';
import { useOptimaDrawers } from './useOptimaDrawers';


const PageCore = (props: { currentApp?: NavItemApp, isMobile?: boolean, children: React.ReactNode }) =>
  <Box sx={{
    display: 'flex', flexDirection: 'column',
    height: '100dvh',
  }}>

    {/* Responsive page bar (pluggable App Center Items and App Menu) */}
    <PageBar
      currentApp={props.currentApp}
      isMobile={props.isMobile}
      sx={{
        zIndex: themeZIndexPageBar,
      }}
    />

    {/* Page (NextJS) must make the assumption they're in a flex-col layout */}
    {props.children}

    {/* [Mobile] Nav bar at the bottom */}
    {/* FIXME: TEMP: Disable mobilenav */}
    {/*{props.isMobile && <MobileNav hideOnFocusMode currentApp={props.currentApp} />}*/}

  </Box>;


/**
 * Loaded Application component, fromt the NextJS page router, wrapped in a Container for centering.
 */
export function PageContainer(props: { currentApp?: NavItemApp, isMobile?: boolean, children: React.ReactNode }) {

  // external state
  const { isDrawerOpen } = useOptimaDrawers();
  const amplitude = useUIPreferencesStore(state =>
    (isPwa() || props.isMobile) ? 'full' : state.centerMode,
  );

  // mobile: no outer containers
  if (props.isMobile)
    return <PageCore isMobile currentApp={props.currentApp}>
      {props.children}
    </PageCore>;

  return (

    <Box
      sx={{
        // full width (this is to the right of the fixed-size desktop drawer)
        flex: 1,

        // when the drawer is off, compensate with a negative margin
        // NOTE: this will cause a transition on the container as well, meaning when we
        // resize the window, the contents will wobble slightly
        marginLeft: !isDrawerOpen
          ? 'calc(-1 * var(--AGI-Desktop-Drawer-width))'
          : 0,
        transition: 'margin-left 0.42s cubic-bezier(.17,.84,.44,1)',
        willChange: 'margin-left',
      }}
    >

      <Container
        disableGutters
        maxWidth={amplitude === 'full' ? false : amplitude === 'narrow' ? 'md' : 'xl'}
        sx={{
          boxShadow: {
            xs: 'none',
            md: amplitude === 'narrow' ? 'md' : 'none',
            xl: amplitude !== 'full' ? 'lg' : 'none',
          },
        }}
      >

        <PageCore currentApp={props.currentApp}>
          {props.children}
        </PageCore>

      </Container>

    </Box>
  );
}