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


// this undoes the PanelGroup styling on mobile, as it's not needed
// NOTE: there may be benefits with the PanelGroup layout, namely that
// it's already 100% x 100% and doesn't scroll, so there would be no
// chance of overflow, and outer limits are set here
const undoPanelGroupSx: React.CSSProperties = {
  display: 'block',
  marginLeft: undefined,
  marginRight: undefined,
  width: undefined,
  height: undefined,
  overflow: undefined,
};


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

        <PanelGroup direction='horizontal' id='root-layout' style={isMobile ? undoPanelGroupSx : undefined}>

          {!isMobile && checkVisibleNav(currentApp) && <DesktopNav component='nav' currentApp={currentApp} />}

          {!isMobile && <DesktopDrawer key='optima-drawer' component='aside' currentApp={currentApp} />}

          {/*<Panel defaultSize={100}>*/}
          <PageWrapper key='app-page-wrapper' component='main' isMobile={isMobile} currentApp={currentApp}>
            {props.children}
          </PageWrapper>
          {/*</Panel>*/}

          {isMobile && <MobileDrawer key='optima-drawer' component='aside' currentApp={currentApp} />}

        </PanelGroup>

      </OptimaDrawerProvider>

      {/* Overlay Modals */}
      <Modals suspendAutoModelsSetup={props.suspendAutoModelsSetup} />

    </OptimaLayoutProvider>
  );
}
