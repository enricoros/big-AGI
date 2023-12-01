import * as React from 'react';
import { create } from 'zustand';
import { shallow } from 'zustand/shallow';

import type { DLLMId } from '~/modules/llms/store-llms';

interface AppLayoutStore {

  // pluggable UI
  drawerItems: React.JSX.Element | null;
  centerItems: React.JSX.Element | null;
  menuItems: React.JSX.Element | null;

  // anchors - for externally closeable menus
  drawerAnchor: HTMLElement | null;
  menuAnchor: HTMLElement | null;

  // modals, which are on the AppLayout
  preferencesTab: number; // 0: closed, 1..N: tab index
  modelsSetupOpen: boolean;
  llmOptionsId: DLLMId | null;
  shortcutsOpen: boolean;

}

const useAppLayoutStore = create<AppLayoutStore>()(
  () => ({

    drawerItems: null,
    centerItems: null,
    menuItems: null,

    drawerAnchor: null,
    menuAnchor: null,

    preferencesTab: 0,
    modelsSetupOpen: false,
    llmOptionsId: null,
    shortcutsOpen: false,

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

export const setLayoutDrawerAnchor = (anchor: HTMLElement | null) => useAppLayoutStore.setState({ drawerAnchor: anchor });
export const closeLayoutDrawer = () => useAppLayoutStore.setState({ drawerAnchor: null });

export const setLayoutMenuAnchor = (anchor: HTMLElement) => useAppLayoutStore.setState({ menuAnchor: anchor });
export const closeLayoutMenu = () => useAppLayoutStore.setState({ menuAnchor: null });

export const useLayoutPreferencesTab = () => useAppLayoutStore(state => state.preferencesTab);
export const openLayoutPreferences = (tab?: number) => useAppLayoutStore.setState({ preferencesTab: tab || 1 });
export const closeLayoutPreferences = () => useAppLayoutStore.setState({ preferencesTab: 0 });

export const useLayoutModelsSetup = (): [open: boolean, llmId: DLLMId | null] => useAppLayoutStore(state => [state.modelsSetupOpen, state.llmOptionsId], shallow);
export const openLayoutModelsSetup = () => useAppLayoutStore.setState({ modelsSetupOpen: true });
export const closeLayoutModelsSetup = () => useAppLayoutStore.setState({ modelsSetupOpen: false });
export const openLayoutLLMOptions = (llmId: DLLMId) => useAppLayoutStore.setState({ llmOptionsId: llmId });
export const closeLayoutLLMOptions = () => useAppLayoutStore.setState({ llmOptionsId: null });
export const useLayoutShortcuts = () => useAppLayoutStore(state => state.shortcutsOpen);
export const openLayoutShortcuts = () => useAppLayoutStore.setState({ shortcutsOpen: true });
export const closeLayoutShortcuts = () => useAppLayoutStore.setState({ shortcutsOpen: false });