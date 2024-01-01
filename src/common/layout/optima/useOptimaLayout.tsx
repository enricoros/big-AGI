import * as React from 'react';

import type { DLLMId } from '~/modules/llms/store-llms';

import { GlobalShortcutItem, useGlobalShortcuts } from '~/common/components/useGlobalShortcut';


const DEBUG_OPTIMA_LAYOUT_PLUGGING = false;


type PC = React.JSX.Element | null;

interface OptimaLayoutState {

  // pluggable UI
  appPaneContent: PC;
  appBarItems: PC;
  appMenuItems: PC;

  // optima modals that can overlay anything
  showPreferencesTab: number;
  showModelsSetup: boolean;
  showLlmOptions: DLLMId | null;
  showShortcuts: boolean;

  // misc/temp
  isFocusedMode: boolean; // when active, the Mobile App menu is not displayed

}

const initialState: OptimaLayoutState = {

  appPaneContent: null,
  appBarItems: null,
  appMenuItems: null,

  showPreferencesTab: 0, // 0 = closed, 1+ open tab n-1
  showModelsSetup: false,
  showLlmOptions: null,
  showShortcuts: false,

  isFocusedMode: false,

};

interface OptimaLayoutActions {
  setPluggableComponents: (
    appPaneContent: PC,
    appBarItems: PC,
    appMenuItems: PC,
  ) => void;

  // commands to open/close optima modals

  openPreferencesTab: (tab?: number) => void;
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

    setPluggableComponents: (appPaneContent: PC, appBarItems: PC, appMenuItems: PC) =>
      setState(state => ({ ...state, appPaneContent, appBarItems, appMenuItems })),

    openPreferencesTab: (tab?: number) => setState(state => ({ ...state, showPreferencesTab: tab || 1 })),
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
  const shortcuts = React.useMemo((): GlobalShortcutItem[] => [
    ['?', true, true, false, actions.openShortcuts],
    ['m', true, true, false, actions.openModelsSetup],
    ['p', true, true, false, actions.openPreferencesTab],
  ], [actions]);
  useGlobalShortcuts(shortcuts);


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


/**
 * used by the active UI client to register its components (and unregister on cleanup)
 */
export const usePluggableOptimaLayout = (appPaneContent: PC, appBarItems: PC, appMenuItems: PC, debugCallerName: string) => {
  const { setPluggableComponents } = useOptimaLayout();

  React.useEffect(() => {
    if (DEBUG_OPTIMA_LAYOUT_PLUGGING)
      console.log(' +PLUG layout', debugCallerName);
    setPluggableComponents(appPaneContent, appBarItems, appMenuItems);

    return () => {
      if (DEBUG_OPTIMA_LAYOUT_PLUGGING)
        console.log(' -UNplug layout', debugCallerName);
      setPluggableComponents(null, null, null);
    };
  }, [appBarItems, appMenuItems, appPaneContent, debugCallerName, setPluggableComponents]);
};
