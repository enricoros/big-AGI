import * as React from 'react';
import { useRouter } from 'next/router';

import { Box } from '@mui/joy';

import { navItems } from '~/common/app.nav';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { DesktopDrawer } from './DesktopDrawer';
import { DesktopNav } from './DesktopNav';
import { MobileDrawer } from './MobileDrawer';
import { Modals } from './Modals';
import { OptimaDrawerProvider } from './useOptimaDrawer';
import { OptimaLayoutProvider } from './useOptimaLayout';
import { PageContainer } from './PageContainer';


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
  const { route } = useRouter();
  const isMobile = useIsMobile();

  // derived state
  const currentApp = navItems.apps.find(item => item.route === route);

  return (
    <OptimaLayoutProvider>
      <OptimaDrawerProvider>

        {isMobile ? <>

          <PageContainer isMobile currentApp={currentApp}>
            {props.children}
          </PageContainer>

          <MobileDrawer currentApp={currentApp} />

        </> : (

          <Box sx={{ display: 'flex' }} id='desktop-layout'>
            <DesktopNav currentApp={currentApp} />

            <DesktopDrawer currentApp={currentApp} />

            <PageContainer currentApp={currentApp}>
              {props.children}
            </PageContainer>
          </Box>

        )}

      </OptimaDrawerProvider>

      {/* Overlay Modals */}
      <Modals suspendAutoModelsSetup={props.suspendAutoModelsSetup} />

    </OptimaLayoutProvider>
  );
}
