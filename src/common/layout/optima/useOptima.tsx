import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import { OptimaActions, PreferencesTabId, useLayoutOptimaStore } from './store-layout-optima';
import { NavItemApp } from '~/common/app.nav';
import { useOptimaPortalHasInputs } from '~/common/layout/optima/portals/useOptimaPortalHasInputs';


// Drawer

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

export function useOptimaDrawerOpen() {
  return useLayoutOptimaStore(({ drawerIsOpen }) => drawerIsOpen);
}

export function useOptimaDrawerPeeking() {
  return useLayoutOptimaStore(({ drawerIsPeeking }) => drawerIsPeeking);
}


// Panel

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

export function useOptimaPanelOpen(isMobile: boolean, currentApp?: NavItemApp) {
  const { panelIsOpen, panelIsPeeking } = useLayoutOptimaStore(useShallow(state => ({
    panelIsOpen: state.panelIsOpen,
    panelIsPeeking: state.panelIsPeeking,
  })));
  const panelAsPopup = !isMobile && currentApp?.panelAsMenu === true;
  const panelHasContent = useOptimaPortalHasInputs('optima-portal-panel') || isMobile;

  return {
    panelIsOpen,
    panelAsPopup,
    panelHasContent,
    panelShownAsPanel: panelIsOpen && panelHasContent && !panelAsPopup,
    panelShownAsPeeking: panelIsPeeking && !panelIsOpen && panelHasContent && !panelAsPopup,
    panelShownAsPopup: panelIsOpen && panelHasContent && panelAsPopup,
  };
}


// Modals

export function optimaActions(): Omit<OptimaActions,
  | 'closeDrawer' | 'openDrawer' | 'toggleDrawer'
  | 'closePanel' | 'openPanel' | 'togglePanel'
  | 'openModels'
  | 'openPreferences'
> {
  return useLayoutOptimaStore.getState();
}

export function optimaOpenModels() {
  useLayoutOptimaStore.getState().openModels();
}

export function optimaOpenPreferences(changeTab?: PreferencesTabId) {
  useLayoutOptimaStore.getState().openPreferences(changeTab);
}

export function useOptimaModals() {
  return useLayoutOptimaStore(useShallow(state => ({
    showAIXDebugger: state.showAIXDebugger,
    showKeyboardShortcuts: state.showKeyboardShortcuts,
    showLogger: state.showLogger,
    showModelOptions: state.showModelOptions,
    showModels: state.showModels,
    showPreferences: state.showPreferences,
    preferencesTab: state.preferencesTab,
  })));
}


// helpers

function _eatMouseEvent(event?: (React.MouseEvent | React.TouchEvent)) {
  if (event) {
    if ('preventDefault' in event) event.preventDefault();
    // if ('stopPropagation' in event) event.stopPropagation();
  }
}
