import * as React from 'react';
import { useRouter } from 'next/router';
import { PanelGroup } from 'react-resizable-panels';

import { Is } from '~/common/util/pwaUtils';
import { checkVisibleNav, navItems } from '~/common/app.nav';
import { useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { useUIPreferencesStore } from '~/common/state/store-ui';

import { DesktopDrawer } from './drawer/DesktopDrawer';
import { DesktopNav } from './nav/DesktopNav';
import { DesktopPanel } from './panel/DesktopPanel';
import { MobileDrawer } from './drawer/MobileDrawer';
import { MobilePanel } from './panel/MobilePanel';
import { Modals } from './Modals';
import { PageWrapper } from './PageWrapper';
import { optimaActions, optimaOpenModels, optimaOpenPreferences } from './useOptima';


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

  // global shortcuts for Optima
  useGlobalShortcuts('OptimaApp', React.useMemo(() => [
    // Preferences & Model dialogs
    { key: ',', ctrl: true, action: optimaOpenPreferences },
    { key: 'm', ctrl: true, shift: true, action: optimaOpenModels },
    // Font Scale
    { key: '+', ctrl: true, shift: true, action: useUIPreferencesStore.getState().increaseContentScaling },
    { key: '-', ctrl: true, shift: true, action: useUIPreferencesStore.getState().decreaseContentScaling },
    // Shortcuts
    { key: Is.OS.MacOS ? '/' : '?', ctrl: true, shift: true, action: optimaActions().openKeyboardShortcuts },
    { key: 'h', ctrl: true, shift: true, action: '_specialPrintShortcuts' },
  ], []));

  return <>

    <PanelGroup direction='horizontal' id='root-layout' style={isMobile ? undoPanelGroupSx : undefined}>


      {/* Desktop: 4 horizontal sections: Nav | Drawer | Page | Panel */}

      {!isMobile && checkVisibleNav(currentApp) && <DesktopNav component='nav' currentApp={currentApp} />}

      {!isMobile && <DesktopDrawer key='optima-drawer' component='aside' currentApp={currentApp} />}

      {/*<Panel defaultSize={100}>*/}
      <PageWrapper key='app-page-wrapper' component='main' isMobile={isMobile} currentApp={currentApp}>
        {props.children}
      </PageWrapper>
      {/*</Panel>*/}

      {!isMobile && <DesktopPanel key='optima-panel' component='aside' currentApp={currentApp} />}


      {/* Mobile - 2 panes overlay the Page */}

      {isMobile && <MobileDrawer key='optima-drawer' component='aside' currentApp={currentApp} />}

      {isMobile && <MobilePanel key='optima-panel' component='aside' currentApp={currentApp} />}


    </PanelGroup>

    {/* Overlay Modals */}
    <Modals suspendAutoModelsSetup={props.suspendAutoModelsSetup} />

  </>;
}
