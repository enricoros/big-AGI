import * as React from 'react';
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';

interface AppLayoutStore {

  // pluggable UI
  drawerItems: React.JSX.Element | null;
  centerItems: React.JSX.Element | null;
  menuItems: React.JSX.Element | null;

  // anchors - for externally closeable menus
  drawerAnchor: HTMLElement | null;
  menuAnchor: HTMLElement | null;

}

const useAppLayoutStore = create<AppLayoutStore>()(
  () => ({

    drawerItems: null,
    centerItems: null,
    menuItems: null,

    drawerAnchor: null,
    menuAnchor: null,

  }),
);


/**
 * used by the active UI client to register its components (and unregister on cleanup)
 */
export function useLayoutPluggable(centerItems: React.JSX.Element | null, drawerItems: React.JSX.Element | null, menuItems: React.JSX.Element | null) {
  React.useEffect(() => {
    useAppLayoutStore.setState({ centerItems, drawerItems, menuItems });
    return () => useAppLayoutStore.setState({ centerItems: null, drawerItems: null, menuItems: null });
  }, [centerItems, drawerItems, menuItems]);
}

export function useLayoutComponents() {
  return useAppLayoutStore(state => ({
    drawerItems: state.drawerItems,
    centerItems: state.centerItems,
    menuItems: state.menuItems,
    drawerAnchor: state.drawerAnchor,
    menuAnchor: state.menuAnchor,
  }), shallow);
}

export function setLayoutDrawerAnchor(anchor: HTMLElement | null) {
  useAppLayoutStore.setState({ drawerAnchor: anchor });
}

export function closeLayoutDrawerMenu() {
  useAppLayoutStore.setState({ drawerAnchor: null });
}

export function setLayoutMenuAnchor(anchor: HTMLElement | null) {
  useAppLayoutStore.setState({ menuAnchor: anchor });
}