import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { OptimaActions, PreferencesTabId, useOptimaStore } from './store-optima';


// configuration
export const DEBUG_OPTIMA_PLUGGING = false;


/// Perform UI Actions

export function optimaActions(): Omit<OptimaActions,
  | 'closeAppMenu' | 'openAppMenu' | 'openModels'
  | 'closeDrawer' | 'openDrawer' | 'toggleDrawer'
  | 'closePanel' | 'openPanel' | 'togglePanel'
  | 'openPreferences'
> {
  return useOptimaStore.getState();
}

export function optimaCloseDrawer() {
  useOptimaStore.getState().closeDrawer();
}

export function optimaOpenDrawer(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useOptimaStore.getState().openDrawer();
}

export function optimaToggleDrawer(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useOptimaStore.getState().toggleDrawer();
}

export function optimaCloseAppMenu() {
  useOptimaStore.getState().closeAppMenu();
}

export function optimaOpenAppMenu(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useOptimaStore.getState().openAppMenu();
}

export function optimaClosePanel() {
  useOptimaStore.getState().closePanel();
}

export function optimaOpenPanel(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useOptimaStore.getState().openPanel();
}

export function optimaTogglePanel(event?: React.MouseEvent) {
  _eatMouseEvent(event);
  useOptimaStore.getState().togglePanel();
}

export function optimaOpenModels() {
  useOptimaStore.getState().openModels();
}

export function optimaOpenPreferences(changeTab?: PreferencesTabId) {
  useOptimaStore.getState().openPreferences(changeTab);
}

function _eatMouseEvent(event?: (React.MouseEvent | React.TouchEvent)) {
  if (event) {
    if ('preventDefault' in event) event.preventDefault();
    // if ('stopPropagation' in event) event.stopPropagation();
  }
}


/// React to UI State (mainly within the Optima Layout itself)

export function useOptimaDrawerOpen() {
  return useOptimaStore(({ drawerIsOpen }) => drawerIsOpen);
}

export function useOptimaAppMenuOpen() {
  return useOptimaStore(({ appMenuIsOpen }) => appMenuIsOpen);
}

export function useOptimaPanelOpen() {
  return useOptimaStore(({ panelIsOpen }) => panelIsOpen);
}

export function useOptimaModalsState() {
  return useOptimaStore(useShallow(state => ({
    showKeyboardShortcuts: state.showKeyboardShortcuts,
    showPreferences: state.showPreferences,
    preferencesTab: state.preferencesTab,
  })));
}

export function useOptimaModelsModalsState() {
  return useOptimaStore(useShallow(state => ({
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
  return useOptimaStore(state => state.menuComponent);
}

/**
 * Registers the Application Menu, to be displayed in the PageBar - used by the active UI application (auto-unregisters on cleanup)
 */
export function useSetOptimaAppMenu(menu: React.ReactNode, debugCallerName: string) {
  React.useEffect(() => {
    if (DEBUG_OPTIMA_PLUGGING) console.log(' +PLUG layout', debugCallerName);
    useOptimaStore.setState({
      menuComponent: menu,
    });
    return () => {
      if (DEBUG_OPTIMA_PLUGGING) console.log(' -UNplug layout', debugCallerName);
      useOptimaStore.setState({
        menuComponent: null,
      });
    };
  }, [debugCallerName, menu]);
}
