import * as React from 'react';
import { create } from 'zustand';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { getIsMobile } from '~/common/components/useMatchMedia';
import { isBrowser } from '~/common/util/pwaUtils';
import { navItems } from '~/common/app.nav';


export type PreferencesTabId = 'chat' | 'voice' | 'draw' | 'tools' | undefined;


interface OptimaState {

  // modes
  // isFocusedMode: boolean; // when active, the Mobile App menu is not displayed

  // pluggable UI components
  menuComponent: React.ReactNode;

  // panes
  drawerIsOpen: boolean;
  menuIsOpen: boolean;

  // modals that can overlay anything
  showKeyboardShortcuts: boolean;
  showModelOptions: DLLMId | false;
  showModels: boolean;
  showPreferences: boolean;
  preferencesTab: PreferencesTabId;

  // timing for drawer
  lastDrawerOpenTime: number;
}

function initialDrawerOpen() {
  // mobile: closed by default
  if (getIsMobile() || !isBrowser)
    return false;

  // desktop: open by default, unless the route has 'hideDrawer' set - then we boot to closed
  const bootNavItem = navItems.apps.find(item => item.route === window.location.pathname);
  return bootNavItem ? !bootNavItem.hideDrawer : false;
}

const initialState: OptimaState = {

  // modes
  // isFocusedMode: false,

  // pluggable UI components
  menuComponent: null,

  // panes
  drawerIsOpen: initialDrawerOpen(),
  menuIsOpen: false,

  // modals that can overlay anything
  showKeyboardShortcuts: false,
  showModelOptions: false,
  showModels: false,
  showPreferences: false,
  preferencesTab: 'chat',

  // timing for drawer
  lastDrawerOpenTime: 0,
};

export interface OptimaActions {

  // setIsFocusedMode: (isFocusedMode: boolean) => void;

  closeDrawer: () => void;
  openDrawer: () => void;
  toggleDrawer: () => void;

  closePageMenu: () => void;
  openPageMenu: () => void;
  togglePageMenu: () => void;

  closeKeyboardShortcuts: () => void;
  openKeyboardShortcuts: () => void;

  closeModelOptions: () => void;
  openModelOptions: (id: DLLMId) => void;

  closeModels: () => void;
  openModels: () => void;

  closePreferences: () => void;
  openPreferences: (changeTab?: PreferencesTabId) => void;

}


export const useOptimaStore = create<OptimaState & OptimaActions>((_set, _get) => ({

  ...initialState,

  // setIsFocusedMode: (isFocusedMode) => _set({ isFocusedMode }),

  closeDrawer: () => {
    // close the drawer, but only if it's been open for 100ms
    if (Date.now() - _get().lastDrawerOpenTime >= 100)
      _set({ drawerIsOpen: false });
  },
  openDrawer: () => _set({ drawerIsOpen: true, lastDrawerOpenTime: Date.now() }),
  toggleDrawer: () => _get().drawerIsOpen ? _get().closeDrawer() : _get().openDrawer(),

  closePageMenu: () => _set({ menuIsOpen: false }),
  openPageMenu: () => _set({ menuIsOpen: true }),
  togglePageMenu: () => _set((state) => ({ menuIsOpen: !state.menuIsOpen })),

  closeKeyboardShortcuts: () => _set({ showKeyboardShortcuts: false }),
  openKeyboardShortcuts: () => _set({ showKeyboardShortcuts: true }),

  closeModelOptions: () => _set({ showModelOptions: false }),
  openModelOptions: (id: DLLMId) => _set({ showModelOptions: id }),

  closeModels: () => _set({ showModels: false }),
  openModels: () => _set({ showModels: true }),

  closePreferences: () => _set({ showPreferences: false }),
  openPreferences: (tab) => _set({ showPreferences: true, ...(tab !== undefined && { preferencesTab: tab }) }),

}));
