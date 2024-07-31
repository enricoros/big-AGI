import * as React from 'react';

import type { DLLMId } from '~/modules/llms/store-llms';

import { isMacUser } from '~/common/util/pwaUtils';
import { useGlobalShortcuts } from '~/common/components/shortcuts/useGlobalShortcuts';
import { useUIPreferencesStore } from '~/common/state/store-ui';


export const PreferencesTab = {
  None: 0,
  Chat: 1,
  Voice: 2,
  Draw: 3,
  Tools: 4,
} as const;

type PreferencesTabType = typeof PreferencesTab[keyof typeof PreferencesTab];



interface OptimaLayoutState {

  // optima modals that can overlay anything
  showPreferencesTab: PreferencesTabType;
  showModelsSetup: boolean;
  showLlmOptions: DLLMId | null;
  showShortcuts: boolean;

  // misc/temp
  isFocusedMode: boolean; // when active, the Mobile App menu is not displayed

}

const initialState: OptimaLayoutState = {

  showPreferencesTab: 0, // 0 = closed, 1+ open tab n-1
  showModelsSetup: false,
  showLlmOptions: null,
  showShortcuts: false,

  isFocusedMode: false,

};

interface OptimaLayoutActions {

  // commands to open/close optima modals

  openPreferencesTab: (tab?: PreferencesTabType) => void;
  closePreferences: () => void;

  openModelsSetup: () => void;
  closeModelsSetup: () => void;

  openLlmOptions: (id: DLLMId) => void;
  closeLlmOptions: () => void;

  openShortcuts: () => void;
  closeShortcuts: () => void;

  setIsFocusedMode: (isFocusedMode: boolean) => void;
}


// React Context with ...state and ...actions
const UseOptimaLayout = React.createContext<
  (OptimaLayoutState & OptimaLayoutActions) | undefined
>(undefined);


export function OptimaLayoutProvider(props: { children: React.ReactNode }) {

  // optima state, only modified by the static actions
  const [state, setState] = React.useState<OptimaLayoutState>(initialState);

  // actions
  const actions: OptimaLayoutActions = React.useMemo(() => ({

    openPreferencesTab: (tab?: PreferencesTabType) => setState(state => ({ ...state, showPreferencesTab: tab || PreferencesTab.Chat })),
    closePreferences: () => setState(state => ({ ...state, showPreferencesTab: 0 })),

    openModelsSetup: () => setState(state => ({ ...state, showModelsSetup: true })),
    closeModelsSetup: () => setState(state => ({ ...state, showModelsSetup: false })),

    openLlmOptions: (id: DLLMId) => setState(state => ({ ...state, showLlmOptions: id })),
    closeLlmOptions: () => setState(state => ({ ...state, showLlmOptions: null })),

    openShortcuts: () => setState(state => ({ ...state, showShortcuts: true })),
    closeShortcuts: () => setState(state => ({ ...state, showShortcuts: false })),

    setIsFocusedMode: (isFocusedMode: boolean) => setState(state => ({ ...state, isFocusedMode })),

  }), []);


  // global shortcuts for Optima
  useGlobalShortcuts('App', React.useMemo(() => [
    { key: 'h', ctrl: true, shift: true, action: '_specialPrintShortcuts' },
    { key: isMacUser ? '/' : '?', ctrl: true, shift: true, action: actions.openShortcuts },
    // Preferences
    { key: ',', ctrl: true, action: actions.openPreferencesTab },
    // Models
    { key: 'm', ctrl: true, shift: true, action: actions.openModelsSetup },
    // Font Scale
    { key: '+', ctrl: true, shift: true, action: useUIPreferencesStore.getState().increaseContentScaling },
    { key: '-', ctrl: true, shift: true, action: useUIPreferencesStore.getState().decreaseContentScaling },
  ], [actions]));


  return (
    <UseOptimaLayout.Provider value={{ ...state, ...actions }}>
      {props.children}
    </UseOptimaLayout.Provider>
  );
}


/**
 * Optima Layout accessor for getting state and actions
 */
export const useOptimaLayout = (): OptimaLayoutState & OptimaLayoutActions => {
  const context = React.useContext(UseOptimaLayout);
  if (!context)
    throw new Error('useOptimaLayout must be used within an OptimaLayoutProvider');
  return context;
};

