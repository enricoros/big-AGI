import * as React from 'react';

import { Box, Container } from '@mui/joy';

import type { NavItemApp } from '~/common/app.nav';
import { isPwa } from '~/common/util/pwaUtils';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { PageCore } from './PageCore';
import { useOptimaDrawerOpen, useOptimaPanelOpen } from './useOptima';


/**
 * Wraps the NextJS Page Component (from the pages router).
 *  - mobile: just the 100dvh pageCore
 *  - desktop: animated left margin (sync with the drawer) and centering via the Container, then the PageCore
 */
export function PageWrapper(props: { component: React.ElementType, currentApp?: NavItemApp, isMobile: boolean, children: React.ReactNode }) {

  // external state
  const isDrawerOpen = useOptimaDrawerOpen();
  const isPanelOpen = useOptimaPanelOpen();
  const amplitude = useUIPreferencesStore(state =>
    (isPwa() || props.isMobile || props.currentApp?.fullWidth) ? 'full' : state.centerMode,
  );

  // mobile: match the desktop container structure, to keep state across layour changes
  if (props.isMobile)
    return (
      <Box>
        <Container id='app-page-container' disableGutters maxWidth={false}>
          <PageCore component={props.component} currentApp={props.currentApp} isMobile={true}>
            {props.children}
          </PageCore>
        </Container>
      </Box>
    );

  return (

    // This wrapper widens the Container/PageCore when the drawer is closed
    <Box
      sx={{
        // full width (this is to the right of the fixed-size desktop drawer)
        flex: '1 1 0px',
        overflow: 'hidden',

        // when the drawer is off, compensate with a negative margin
        // NOTE: this will cause a transition on the container as well, meaning when we
        // resize the window, the contents will wobble slightly
        marginLeft: !isDrawerOpen
          ? 'calc(-1 * var(--AGI-Desktop-Drawer-width))'
          : 0,
        marginRight: !isPanelOpen
          ? 'calc(-1 * var(--AGI-Desktop-Panel-width))'
          : 0,
        transition: 'margin-left 0.42s cubic-bezier(.17,.84,.44,1), margin-right 0.42s cubic-bezier(.17,.84,.44,1)',
        willChange: 'margin-left, margin-right',
      }}
    >

      <Container
        id='app-page-container'
        disableGutters
        maxWidth={amplitude === 'full' ? false : amplitude === 'narrow' ? 'md' : 'xl'}
        sx={{
          boxShadow: {
            xs: 'none',
            md: amplitude === 'narrow' ? '0px 0px 4px 0 rgba(50 56 62 / 0.12)' : 'none',
            xl: amplitude !== 'full' ? '0px 0px 4px 0 rgba(50 56 62 / 0.12)' : 'none',
          },
        }}
      >

        <PageCore component={props.component} currentApp={props.currentApp} isMobile={false}>
          {props.children}
        </PageCore>

      </Container>

    </Box>
  );
}