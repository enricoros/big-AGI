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

  // anchors - for externally closeable menus
  appDrawerAnchor: HTMLElement | null;
  appMenuAnchor: HTMLElement | null;

  // modals that can overlay anything
  showPreferencesTab: number;
  showModelsSetup: boolean;
  showLlmOptions: DLLMId | null;
  showShortcuts: boolean;

}

const initialState: OptimaLayoutState = {

  appPaneContent: null,
  appBarItems: null,
  appMenuItems: null,

  appDrawerAnchor: null,
  appMenuAnchor: null,

  showPreferencesTab: 0, // 0 = closed, 1+ open tab n-1
  showModelsSetup: false,
  showLlmOptions: null,
  showShortcuts: false,

};

interface OptimaLayoutActions {
  setPluggableComponents: (
    appPaneContent: PC,
    appBarItems: PC,
    appMenuItems: PC,
  ) => void;

  setAppDrawerAnchor: (anchor: HTMLElement | null) => void;
  closeAppDrawer: () => void;

  setAppMenuAnchor: (anchor: HTMLElement | null) => void;
  closeAppMenu: () => void;

  openPreferences: (tab?: number) => void;
  closePreferences: () => void;

  openModelsSetup: () => void;
  closeModelsSetup: () => void;

  openLlmOptions: (id: DLLMId) => void;
  closeLlmOptions: () => void;

  openShortcuts: () => void;
  closeShortcuts: () => void;
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

    setAppDrawerAnchor: (anchor: HTMLElement | null) => setState(state => ({ ...state, appDrawerAnchor: anchor })),
    closeAppDrawer: () => setState(state => ({ ...state, appDrawerAnchor: null })),

    setAppMenuAnchor: (anchor: HTMLElement | null) => setState(state => ({ ...state, appMenuAnchor: anchor })),
    closeAppMenu: () => setState(state => ({ ...state, appMenuAnchor: null })),

    openPreferences: (tab?: number) => setState(state => ({ ...state, showPreferencesTab: tab || 1 })),
    closePreferences: () => setState(state => ({ ...state, showPreferencesTab: 0 })),

    openModelsSetup: () => setState(state => ({ ...state, showModelsSetup: true })),
    closeModelsSetup: () => setState(state => ({ ...state, showModelsSetup: false })),

    openLlmOptions: (id: DLLMId) => setState(state => ({ ...state, showLlmOptions: id })),
    closeLlmOptions: () => setState(state => ({ ...state, showLlmOptions: null })),

    openShortcuts: () => setState(state => ({ ...state, showShortcuts: true })),
    closeShortcuts: () => setState(state => ({ ...state, showShortcuts: false })),

  }), []);


  // global shortcuts for Optima
  const shortcuts = React.useMemo((): GlobalShortcutItem[] => [
    ['?', true, true, false, actions.openShortcuts],
    ['m', true, true, false, actions.openModelsSetup],
    ['p', true, true, false, actions.openPreferences],
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
