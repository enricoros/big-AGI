import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { DEBUG_OPTIMA_PLUGGING, OptimaActions, OptimaPreferencesTab, useOptimaStore } from './store-optima';


/// Perform UI Actions

export function optimaActions(): Omit<OptimaActions, 'openModels' | 'openPreferences'> {
  return useOptimaStore.getState();
}

export function optimaOpenModels() {
  useOptimaStore.getState().openModels();
}

export function optimaOpenPreferences(changeTab?: OptimaPreferencesTab) {
  useOptimaStore.getState().openPreferences(changeTab);
}


/// React to UI State (mainly within the Optima Layout itself)

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
  return useOptimaStore(state => state.appMenuComponent);
}

/**
 * Registers the Application Menu, to be displayed in the PageBar - used by the active UI application (auto-unregisters on cleanup)
 */
export function useSetOptimaAppMenu(menu: React.ReactNode, debugCallerName: string) {
  React.useEffect(() => {
    if (DEBUG_OPTIMA_PLUGGING) console.log(' +PLUG layout', debugCallerName);
    useOptimaStore.setState({
      appMenuComponent: menu,
    });
    return () => {
      if (DEBUG_OPTIMA_PLUGGING) console.log(' -UNplug layout', debugCallerName);
      useOptimaStore.setState({
        appMenuComponent: null,
      });
    };
  }, [debugCallerName, menu]);
}
