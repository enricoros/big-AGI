import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { OptimaActions, PreferencesTabId, useLayoutOptimaStore } from './store-layout-optima';


// configuration
export const DEBUG_OPTIMA_PLUGGING = false;


/// Perform UI Actions

export function optimaActions(): Omit<OptimaActions,
  | 'closeAppMenu' | 'openAppMenu' | 'openModels'
  | 'closeDrawer' | 'openDrawer' | 'toggleDrawer'
  | 'closePanel' | 'openPanel' | 'togglePanel'
  | 'openPreferences'
> {
  return useLayoutOptimaStore.getState();
}

export function optimaCloseDrawer() {
  useLayoutOptimaStore.getState().closeDrawer();
}

export function optimaOpenDrawer(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useLayoutOptimaStore.getState().openDrawer();
}

export function optimaToggleDrawer(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useLayoutOptimaStore.getState().toggleDrawer();
}

export function optimaCloseAppMenu() {
  useLayoutOptimaStore.getState().closeAppMenu();
}

export function optimaOpenAppMenu(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useLayoutOptimaStore.getState().openAppMenu();
}

export function optimaClosePanel() {
  useLayoutOptimaStore.getState().closePanel();
}

export function optimaOpenPanel(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useLayoutOptimaStore.getState().openPanel();
}

export function optimaTogglePanel(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useLayoutOptimaStore.getState().togglePanel();
}

export function optimaOpenModels() {
  useLayoutOptimaStore.getState().openModels();
}

export function optimaOpenPreferences(changeTab?: PreferencesTabId) {
  useLayoutOptimaStore.getState().openPreferences(changeTab);
}

function _eatMouseEvent(event?: (React.MouseEvent | React.TouchEvent)) {
  if (event) {
    if ('preventDefault' in event) event.preventDefault();
    // if ('stopPropagation' in event) event.stopPropagation();
  }
}


/// React to UI State (mainly within the Optima Layout itself)

export function useOptimaDrawerOpen() {
  return useLayoutOptimaStore(({ drawerIsOpen }) => drawerIsOpen);
}

export function useOptimaAppMenuOpen() {
  return useLayoutOptimaStore(({ appMenuIsOpen }) => appMenuIsOpen);
}

export function useOptimaPanelOpen() {
  return useLayoutOptimaStore(({ panelIsOpen }) => panelIsOpen);
}

export function useOptimaModalsState() {
  return useLayoutOptimaStore(useShallow(state => ({
    showKeyboardShortcuts: state.showKeyboardShortcuts,
    showPreferences: state.showPreferences,
    preferencesTab: state.preferencesTab,
  })));
}

export function useOptimaModelsModalsState() {
  return useLayoutOptimaStore(useShallow(state => ({
    showModelOptions: state.showModelOptions,
    showModels: state.showModels,
    showPreferences: state.showPreferences,
  })));
}


/// Pluggable UI - Note: Portals are handled differently

/**
 * Reacts the App Menu component
 */
export function useOptimaAppMenu() {
  return useLayoutOptimaStore(state => state.menuComponent);
}

/**
 * Registers the Application Menu, to be displayed in the PageBar - used by the active UI application (auto-unregisters on cleanup)
 */
export function useSetOptimaAppMenu(menu: React.ReactNode, debugCallerName: string) {
  React.useEffect(() => {
    if (DEBUG_OPTIMA_PLUGGING) console.log(' +PLUG layout', debugCallerName);
    useLayoutOptimaStore.setState({
      menuComponent: menu,
    });
    return () => {
      if (DEBUG_OPTIMA_PLUGGING) console.log(' -UNplug layout', debugCallerName);
      useLayoutOptimaStore.setState({
        menuComponent: null,
      });
    };
  }, [debugCallerName, menu]);
}
