import * as React from 'react';

import { getIsMobile } from '~/common/components/useMatchMedia';


interface OptimaDrawerState {
  isDrawerOpen: boolean;
}

interface OptimaDrawerActions {
  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}


const UseOptimaDrawer = React.createContext<(OptimaDrawerState & OptimaDrawerActions) | undefined>(undefined);

// TRICK: this is how we persist the drawer state across page navigations
let lastOpenState = !getIsMobile();

export function OptimaDrawerProvider(props: { children: React.ReactNode }) {

  // state
  const [drawerOpen, setDrawerOpen] = React.useState(lastOpenState);

  // actions
  const actions: OptimaDrawerActions = React.useMemo(() => ({

    toggleDrawer: () => setDrawerOpen(state => lastOpenState = !state),
    openDrawer: () => setDrawerOpen(lastOpenState = true),
    closeDrawer: () => setDrawerOpen(lastOpenState = false),

  }), []);

  return (
    <UseOptimaDrawer.Provider value={{ isDrawerOpen: drawerOpen, ...actions }}>
      {props.children}
    </UseOptimaDrawer.Provider>
  );
}


/**
 * Optima Drawer access for getting state and actions
 */
export const useOptimaDrawer = () => {
  const context = React.useContext(UseOptimaDrawer);
  if (!context)
    throw new Error('useOptimaDrawer must be used within an OptimaDrawerProvider');
  return context;
};