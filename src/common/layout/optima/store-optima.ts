import * as React from 'react';
import { create } from 'zustand';

import type { DLLMId } from '~/modules/llms/store-llms';


// configuration
export const DEBUG_OPTIMA_PLUGGING = false;

export type OptimaPreferencesTab = 'chat' | 'voice' | 'draw' | 'tools' | undefined;

interface OptimaState {

  // pluggable UI components
  appMenuComponent: React.ReactNode;

  // modes
  isFocusedMode: boolean; // when active, the Mobile App menu is not displayed

  // modals that can overlay anything
  showKeyboardShortcuts: boolean;
  showModelOptions: DLLMId | false;
  showModels: boolean;
  showPreferences: boolean;
  preferencesTab: OptimaPreferencesTab;

}

const initialState: OptimaState = {

  // pluggable UI components
  appMenuComponent: null,

  // modes
  isFocusedMode: false,

  // modals that can overlay anything
  showKeyboardShortcuts: false,
  showModelOptions: false,
  showModels: false,
  showPreferences: false,
  preferencesTab: 'chat',

};

export interface OptimaActions {

  setIsFocusedMode: (isFocusedMode: boolean) => void;

  closeKeyboardShortcuts: () => void;
  openKeyboardShortcuts: () => void;

  closeModelOptions: () => void;
  openModelOptions: (id: DLLMId) => void;

  closeModels: () => void;
  openModels: () => void;

  closePreferences: () => void;
  openPreferences: (changeTab?: OptimaPreferencesTab) => void;

}


export const useOptimaStore = create<OptimaState & OptimaActions>((_set, _get) => ({

  ...initialState,

  setIsFocusedMode: (isFocusedMode) => _set({ isFocusedMode }),

  closeKeyboardShortcuts: () => _set({ showKeyboardShortcuts: false }),
  openKeyboardShortcuts: () => _set({ showKeyboardShortcuts: true }),

  closeModelOptions: () => _set({ showModelOptions: false }),
  openModelOptions: (id: DLLMId) => _set({ showModelOptions: id }),

  closeModels: () => _set({ showModels: false }),
  openModels: () => _set({ showModels: true }),

  closePreferences: () => _set({ showPreferences: false }),
  openPreferences: (tab) => _set({ showPreferences: true, ...(tab !== undefined && { preferencesTab: tab }) }),

}));
