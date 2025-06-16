import { create } from 'zustand';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { getIsMobile } from '~/common/components/useMatchMedia';
import { isBrowser } from '~/common/util/pwaUtils';
import { navItems } from '~/common/app.nav';

import { OPTIMA_OPEN_DEBOUNCE, OPTIMA_PEEK_HOVER_ENTER_DELAY, OPTIMA_PEEK_HOVER_ENTER_DELAY_PANEL, OPTIMA_PEEK_HOVER_TIMEOUT } from './optima.config';


export type PreferencesTabId = 'chat' | 'voice' | 'draw' | 'tools' | undefined;


interface OptimaState {

  // modes
  // isFocusedMode: boolean; // when active, the Mobile App menu is not displayed

  // panes
  drawerIsOpen: boolean;
  drawerIsPeeking: boolean;
  panelIsOpen: boolean;
  panelIsPeeking: boolean;

  // modals
  showAIXDebugger: boolean;
  showKeyboardShortcuts: boolean;
  showLogger: boolean;
  showModelOptions: DLLMId | false;
  showModels: boolean;
  showPreferences: boolean;
  preferencesTab: PreferencesTabId;

  // timing for panels
  lastDrawerOpenTime: number;
  lastPanelOpenTime: number;
}

function initialDrawerOpen() {
  // mobile: closed by default
  if (getIsMobile() || !isBrowser)
    return false;

  // desktop: open by default, unless the route has 'hideDrawer' set - then we boot to closed
  const bootNavItem = navItems.apps.find(item => item.route === window.location.pathname);
  return bootNavItem ? !bootNavItem.hideDrawer : false;
}

const modalsClosedState = {
  showAIXDebugger: false,
  showKeyboardShortcuts: false,
  showLogger: false,
  showModelOptions: false,
  showModels: false,
  showPreferences: false,
} as const;

const initialState: OptimaState = {

  // modes
  // isFocusedMode: false,

  // panes
  drawerIsOpen: initialDrawerOpen(),
  drawerIsPeeking: false,
  panelIsOpen: false,
  panelIsPeeking: false,

  // modals that can overlay anything
  ...modalsClosedState,
  preferencesTab: 'chat',

  // timings
  lastDrawerOpenTime: 0,
  lastPanelOpenTime: 0,
} as const;

export interface OptimaActions {

  // setIsFocusedMode: (isFocusedMode: boolean) => void;

  closeDrawer: () => void;
  openDrawer: () => void;
  toggleDrawer: () => void;
  peekDrawerEnter: () => void;
  peekDrawerLeave: () => void;

  closePanel: () => void;
  openPanel: () => void;
  togglePanel: () => void;
  peekPanelEnter: () => void;
  peekPanelLeave: () => void;

  closeAIXDebugger: () => void;
  openAIXDebugger: () => void;

  closeKeyboardShortcuts: () => void;
  openKeyboardShortcuts: () => void;

  closeLogger: () => void;
  openLogger: () => void;

  closeModelOptions: () => void;
  openModelOptions: (id: DLLMId) => void;

  closeModels: () => void;
  openModels: () => void;

  closePreferences: () => void;
  openPreferences: (changeTab?: PreferencesTabId) => void;

}


const drawerPeek = createPeekHandlers('drawerIsOpen', 'drawerIsPeeking');
const panelPeek = createPeekHandlers('panelIsOpen', 'panelIsPeeking', OPTIMA_PEEK_HOVER_ENTER_DELAY_PANEL);

function createPeekHandlers<
  TOpenKey extends keyof OptimaState,
  TPeekingKey extends keyof OptimaState,
>(isOpenKey: TOpenKey, isPeekingKey: TPeekingKey, overrideEnterDelay?: number) {
  let enterTimer: any = null;
  let leaveTimer: any = null;

  return {
    cancel: () => {
      clearTimeout(enterTimer);
      clearTimeout(leaveTimer);
      enterTimer = null;
      leaveTimer = null;
    },
    enter: (_get: () => OptimaState, _set: (state: Partial<OptimaState>) => void) => {
      clearTimeout(leaveTimer);
      leaveTimer = null;

      const state = _get();
      if (state[isOpenKey] || state[isPeekingKey]) return;

      clearTimeout(enterTimer);
      enterTimer = setTimeout(() => {
        _set({ [isPeekingKey]: true } as Partial<OptimaState>);
        enterTimer = null;
      }, overrideEnterDelay ?? OPTIMA_PEEK_HOVER_ENTER_DELAY);
    },
    leave: (_get: () => OptimaState, _set: (state: Partial<OptimaState>) => void) => {
      clearTimeout(enterTimer);
      enterTimer = null;

      const state = _get();
      if (!state[isPeekingKey]) return;

      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        _set({ [isPeekingKey]: false } as Partial<OptimaState>);
        leaveTimer = null;
      }, OPTIMA_PEEK_HOVER_TIMEOUT);
    },
  };
}


export const useLayoutOptimaStore = create<OptimaState & OptimaActions>((_set, _get) => ({

  ...initialState,

  // setIsFocusedMode: (isFocusedMode) => _set({ isFocusedMode }),

  closeDrawer: () => {
    // prevent accidental immediate close (e.g. double-click, animation protection)
    if (Date.now() - _get().lastDrawerOpenTime < OPTIMA_OPEN_DEBOUNCE) return;
    drawerPeek.cancel();
    _set({ drawerIsOpen: false, drawerIsPeeking: false });
  },
  openDrawer: () => {
    drawerPeek.cancel();
    _set({ drawerIsOpen: true, drawerIsPeeking: false, lastDrawerOpenTime: Date.now() });
  },
  toggleDrawer: () => _get().drawerIsOpen ? _get().closeDrawer() : _get().openDrawer(),
  peekDrawerEnter: () => drawerPeek.enter(_get, _set),
  peekDrawerLeave: () => drawerPeek.leave(_get, _set),

  closePanel: () => {
    // prevent accidental immediate close (e.g. double-click, animation protection)
    if (Date.now() - _get().lastPanelOpenTime < OPTIMA_OPEN_DEBOUNCE) return;
    panelPeek.cancel();
    _set({ panelIsOpen: false, panelIsPeeking: false });
  },
  openPanel: () => {
    panelPeek.cancel();
    _set({ panelIsOpen: true, panelIsPeeking: false, lastPanelOpenTime: Date.now() });
  },
  togglePanel: () => _get().panelIsOpen ? _get().closePanel() : _get().openPanel(),
  peekPanelEnter: () => panelPeek.enter(_get, _set),
  peekPanelLeave: () => panelPeek.leave(_get, _set),

  closeAIXDebugger: () => _set({ showAIXDebugger: false }),
  openAIXDebugger: () => _set({ ...modalsClosedState, showAIXDebugger: true }),

  closeKeyboardShortcuts: () => _set({ showKeyboardShortcuts: false }),
  openKeyboardShortcuts: () => _set({ showKeyboardShortcuts: true }),

  closeLogger: () => _set({ showLogger: false }),
  openLogger: () => _set({ ...modalsClosedState, showLogger: true }),

  closeModelOptions: () => _set({ showModelOptions: false }),
  openModelOptions: (id: DLLMId) => _set({ showModelOptions: id }),

  closeModels: () => _set({ showModels: false }),
  openModels: () => _set({ showModels: true }),

  closePreferences: () => _set({ showPreferences: false }),
  openPreferences: (tab) => _set({ showPreferences: true, ...(tab !== undefined && { preferencesTab: tab }) }),

}));
