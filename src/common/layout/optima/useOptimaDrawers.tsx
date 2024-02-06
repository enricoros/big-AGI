import * as React from 'react';

import { getIsMobile } from '~/common/components/useMatchMedia';
import { isBrowser } from '~/common/util/pwaUtils';


interface OptimaDrawersState {
  isDrawerOpen: boolean;
  isPageMenuOpen: boolean;
}

interface OptimaDrawersActions {
  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  closeDrawerOnMobile: () => void;

  togglePageMenu: () => void;
  openPageMenu: () => void;
  closePageMenu: () => void;
}


const UseOptimaDrawers = React.createContext<(OptimaDrawersState & OptimaDrawersActions) | undefined>(undefined);

// TRICK: this is how we persist the drawer state across page navigations
let lastDrawerOpen = !getIsMobile() && !(isBrowser && window.location.pathname === '/news');

export function OptimaDrawerProvider(props: { children: React.ReactNode }) {

  // state
  const [drawerOpen, setDrawerOpen] = React.useState(lastDrawerOpen);
  const [pageMenuOpen, setPageMenuOpen] = React.useState(false);

  // actions
  const actions: OptimaDrawersActions = React.useMemo(() => ({

    toggleDrawer: () => setDrawerOpen(state => lastDrawerOpen = !state),
    openDrawer: () => setDrawerOpen(lastDrawerOpen = true),
    closeDrawer: () => setDrawerOpen(lastDrawerOpen = false),
    closeDrawerOnMobile: () => getIsMobile() && setDrawerOpen(lastDrawerOpen = false),

    togglePageMenu: () => setPageMenuOpen(state => !state),
    openPageMenu: () => setPageMenuOpen(true),
    closePageMenu: () => setPageMenuOpen(false),

  }), []);

  return (
    <UseOptimaDrawers.Provider value={{ isDrawerOpen: drawerOpen, isPageMenuOpen: pageMenuOpen, ...actions }}>
      {props.children}
    </UseOptimaDrawers.Provider>
  );
}


/**
 * Optima Drawers access for getting state and actions
 */
export const useOptimaDrawers = () => {
  const context = React.useContext(UseOptimaDrawers);
  if (!context)
    throw new Error('useOptimaDrawer must be used within an OptimaDrawerProvider');
  // NOTE: shall we merge Drawers and Layout? They cascade anyway, and there are benefits to having them together
  // const { appDrawerContent } = useOptimaLayout();
  // return {
  //   ...context,
  //   isDrawerOpen: context.isDrawerOpen && !!appDrawerContent,
  // };
  return context;
};