import * as React from 'react';
import { create } from 'zustand';


// configuration
const DEBUG_OPTIMA_LAYOUT_PLUGGING = false;


interface OptimaLayoutState {

  appMenuComponent: React.ReactNode;

}

const initialState: OptimaLayoutState = {

  appMenuComponent: null,

  // showPreferencesTab: 0, // 0 = closed, 1+ open tab n-1
  // showModelsSetup: false,
  // showLlmOptions: null,
  // showShortcuts: false,
  //
  // isFocusedMode: false,

};

interface OptimaLayoutStore extends OptimaLayoutState {


}


const useOptimaLayoutStore = create<OptimaLayoutStore>((_set, _get) => ({

  // default state
  ...initialState,

}));


// displays the component
export function useOptimaLayoutAppMenu() {
  return useOptimaLayoutStore(state => state.appMenuComponent);
}

/**
 * Registers the Application Menu, to be displayed in the PageBar - used by the active UI application (auto-unregisters on cleanup)
 */
export function useSetOptimaLayoutAppMenu(menu: React.ReactNode, debugCallerName: string) {
  React.useEffect(() => {
    if (DEBUG_OPTIMA_LAYOUT_PLUGGING) console.log(' +PLUG layout', debugCallerName);
    useOptimaLayoutStore.setState({
      appMenuComponent: menu,
    });
    return () => {
      if (DEBUG_OPTIMA_LAYOUT_PLUGGING) console.log(' -UNplug layout', debugCallerName);
      useOptimaLayoutStore.setState({
        appMenuComponent: null,
      });
    };
  }, [debugCallerName, menu]);
}
