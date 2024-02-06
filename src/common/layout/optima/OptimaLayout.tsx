import * as React from 'react';
import { useRouter } from 'next/router';
import { PanelGroup } from 'react-resizable-panels';

import { checkVisibleNav, navItems } from '~/common/app.nav';
import { useIsMobile } from '~/common/components/useMatchMedia';

import { DesktopDrawer } from './DesktopDrawer';
import { DesktopNav } from './DesktopNav';
import { MobileDrawer } from './MobileDrawer';
import { Modals } from './Modals';
import { OptimaDrawerProvider } from './useOptimaDrawers';
import { OptimaLayoutProvider } from './useOptimaLayout';
import { PageWrapper } from './PageWrapper';


/**
 * Core layout of big-AGI, used by all the Primary applications therein.
 *
 * Main functions:
 *  - modern responsive layout
 *  - core layout of the application, with the Nav, Panes, PageBar, etc.
 *    - the child(ren) of this layout are placed in the main content area
 *  - allows for pluggable components of children applications, via usePluggableOptimaLayout
 *  - overlays and displays various modals
 *  - flicker free
 */
export function OptimaLayout(props: { suspendAutoModelsSetup?: boolean, children: React.ReactNode }) {

  // external state
  const { route } = useRouter();
  const isMobile = useIsMobile();

  // derived state
  const currentApp = navItems.apps.find(item => item.route === route);

  return (
    <OptimaLayoutProvider>
      <OptimaDrawerProvider>

        {isMobile ? <>

          <PageWrapper component='main' isMobile currentApp={currentApp}>
            {props.children}
          </PageWrapper>

          <MobileDrawer component='aside' currentApp={currentApp} />

        </> : (

          <PanelGroup direction='horizontal' id='root-layout'>

            {checkVisibleNav(currentApp) && <DesktopNav component='nav' currentApp={currentApp} />}

            <DesktopDrawer component='aside' currentApp={currentApp} />

            {/*<Panel defaultSize={100}>*/}
            <PageWrapper component='main' currentApp={currentApp}>
              {props.children}
            </PageWrapper>
            {/*</Panel>*/}

          </PanelGroup>

        )}

      </OptimaDrawerProvider>

      {/* Overlay Modals */}
      <Modals suspendAutoModelsSetup={props.suspendAutoModelsSetup} />

    </OptimaLayoutProvider>
  );
}
