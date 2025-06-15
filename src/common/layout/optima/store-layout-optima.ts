import { create } from 'zustand';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { getIsMobile } from '~/common/components/useMatchMedia';
import { isBrowser } from '~/common/util/pwaUtils';
import { navItems } from '~/common/app.nav';

import { OPTIMA_DRAWER_HOVER_ENTER_DELAY, OPTIMA_DRAWER_HOVER_TIMEOUT, OPTIMA_DRAWER_OPEN_DEBOUNCE } from './optima.config';


export type PreferencesTabId = 'chat' | 'voice' | 'draw' | 'tools' | undefined;


interface OptimaState {

  // modes
  // isFocusedMode: boolean; // when active, the Mobile App menu is not displayed

  // panes
  drawerIsOpen: boolean;
  drawerIsPeeking: boolean;
  panelIsOpen: boolean;

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


// global state: peek hover logic timers
let peekEnterTimeoutId: ReturnType<typeof setTimeout> | null = null;
let peekLeaveTimeoutId: ReturnType<typeof setTimeout> | null = null;

function cancelPeekTimers(which?: 'enter' | 'leave') {
  if (which !== 'leave' && peekEnterTimeoutId) {
    clearTimeout(peekEnterTimeoutId);
    peekEnterTimeoutId = null;
  }
  if (which !== 'enter' && peekLeaveTimeoutId) {
    clearTimeout(peekLeaveTimeoutId);
    peekLeaveTimeoutId = null;
  }
}


export const useLayoutOptimaStore = create<OptimaState & OptimaActions>((_set, _get) => ({

  ...initialState,

  // setIsFocusedMode: (isFocusedMode) => _set({ isFocusedMode }),

  closeDrawer: () => {
    // prevent accidental immediate close (e.g. double-click, animation protection)
    if (Date.now() - _get().lastDrawerOpenTime < OPTIMA_DRAWER_OPEN_DEBOUNCE) return;
    cancelPeekTimers();
    _set({ drawerIsOpen: false, drawerIsPeeking: false });
  },
  openDrawer: () => {
    cancelPeekTimers();
    _set({ drawerIsOpen: true, drawerIsPeeking: false, lastDrawerOpenTime: Date.now() });
  },
  toggleDrawer: () => _get().drawerIsOpen ? _get().closeDrawer() : _get().openDrawer(),

  peekDrawerEnter: () => {
    cancelPeekTimers('leave');

    // if drawer is already open, no need to peek
    const { drawerIsOpen, drawerIsPeeking } = _get();
    if (drawerIsOpen || drawerIsPeeking) return;

    // start a new timer to show the drawer after a small delay
    cancelPeekTimers('enter');
    peekEnterTimeoutId = setTimeout(() => {
      _set({ drawerIsPeeking: true });
      peekEnterTimeoutId = null;
    }, OPTIMA_DRAWER_HOVER_ENTER_DELAY);
  },
  peekDrawerLeave: () => {
    cancelPeekTimers('enter');

    // only start leave timer if currently peeking
    const { drawerIsPeeking } = _get();
    if (!drawerIsPeeking) return;

    // start a new timer to hide the drawer
    cancelPeekTimers('leave');
    peekLeaveTimeoutId = setTimeout(() => {
      _set({ drawerIsPeeking: false });
      peekLeaveTimeoutId = null;
    }, OPTIMA_DRAWER_HOVER_TIMEOUT);
  },

  closePanel: () => {
    // NOTE: would this make sense?
    // if (Date.now() - _get().lastPanelOpenTime >= 100)
    //   _set({ panelIsOpen: false });
    _set({ panelIsOpen: false });
  },
  openPanel: () => _set({ panelIsOpen: true, lastPanelOpenTime: Date.now() }),
  togglePanel: () => _get().panelIsOpen ? _get().closePanel() : _get().openPanel(),

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
