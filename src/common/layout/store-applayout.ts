import * as React from 'react';
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';

interface AppLayoutStore {
  // anchors - for externally closeable menus
  drawerAnchor: HTMLElement | null;
  menuAnchor: HTMLElement | null;

  // pluggable UI
  drawerItems: React.JSX.Element | null;
  centerItems: React.JSX.Element | null;
  menuItems: React.JSX.Element | null;
}

const useAppLayoutStore = create<AppLayoutStore>()(
  () => ({
    drawerAnchor: null,
    menuAnchor: null,
    drawerItems: null,
    centerItems: null,
    menuItems: null,
  }),
);


/**
 * used by the active UI client to register its components (and unregister on cleanup)
 */
export function useLayoutPluggable(centerItems: React.JSX.Element, drawerItems: React.JSX.Element, menuItems: React.JSX.Element) {
  React.useEffect(() => {
    useAppLayoutStore.setState({ centerItems, drawerItems, menuItems });
    return () => useAppLayoutStore.setState({ centerItems: null, drawerItems: null, menuItems: null });
  }, [centerItems, drawerItems, menuItems]);
}

export function useLayoutComponents() {
  return useAppLayoutStore(state => ({
    drawerAnchor: state.drawerAnchor,
    menuAnchor: state.menuAnchor,
    drawerItems: state.drawerItems,
    centerItems: state.centerItems,
    menuItems: state.menuItems,
  }), shallow);
}

export function setLayoutDrawerAnchor(anchor: HTMLElement | null) {
  useAppLayoutStore.setState({ drawerAnchor: anchor });
}

export function setLayoutMenuAnchor(anchor: HTMLElement | null) {
  useAppLayoutStore.setState({ menuAnchor: anchor });
}