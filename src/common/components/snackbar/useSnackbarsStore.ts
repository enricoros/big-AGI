import { create } from 'zustand';

import type { SnackbarTypeMap } from '@mui/joy';

import { agiUuid } from '~/common/util/idUtils';


export const SNACKBAR_ANIMATION_DURATION = 200;

export interface SnackbarMessage {
  key: string;
  message: string;
  type: 'success' | 'issue' | 'center-title' | 'info' | 'precondition-fail';
  closeButton?: boolean,
  overrides?: Partial<SnackbarTypeMap['props']>;
}

interface SnackbarStore {

  // state
  activeMessage: SnackbarMessage | null;
  activeSnackbarOpen: boolean;
  snackbarQueue: SnackbarMessage[];

  // actions
  addSnackbar: (snackbar: SnackbarMessage) => string;
  animateCloseSnackbar: () => void;
  closeSnackbar: () => void;
  removeSnackbar: (key: string) => void;

}


export const useSnackbarsStore = create<SnackbarStore>()(
  (_set, _get) => ({

    activeMessage: null,
    activeSnackbarOpen: true,
    snackbarQueue: [],

    addSnackbar: (snackbar: SnackbarMessage): string => {
      const { activeMessage } = _get();
      let { key, ...rest } = snackbar;

      // unique key
      key += '-' + agiUuid('snackbar-item');

      // append the snackbar
      const newSnackbar = { key, ...rest };
      _set(activeMessage === null
        ? {
          activeMessage: newSnackbar,
          activeSnackbarOpen: true,
        }
        : {
          snackbarQueue: [..._get().snackbarQueue, newSnackbar],
        });

      return key;
    },

    closeSnackbar: () =>
      _set((state) => {
        let nextActiveSnackbar = null;
        let nextQueue = [...state.snackbarQueue];
        if (nextQueue.length > 0)
          nextActiveSnackbar = nextQueue.shift(); // Remove the first snackbar from the queue
        return {
          activeMessage: nextActiveSnackbar,
          activeSnackbarOpen: nextActiveSnackbar !== null,
          snackbarQueue: nextQueue,
        };
      }),

    animateCloseSnackbar: () => {
      _set({
        activeSnackbarOpen: false,
      });
      setTimeout(() => {
        _get().closeSnackbar();
      }, SNACKBAR_ANIMATION_DURATION); // Delay needs to match match your CSS animation duration
    },

    // mostly added for useEffect's unmounts
    removeSnackbar: (key: string) =>
      _set((state) => {
        let nextActiveSnackbar = state.activeMessage;
        let nextQueue = [...state.snackbarQueue];
        if (nextActiveSnackbar?.key === key) {
          if (nextQueue.length > 0)
            nextActiveSnackbar = nextQueue.shift() as SnackbarMessage; // Remove the first snackbar from the queue
          else
            nextActiveSnackbar = null;
          return {
            activeMessage: nextActiveSnackbar,
            activeSnackbarOpen: nextActiveSnackbar !== null,
            snackbarQueue: nextQueue,
          };
        }
        return {
          snackbarQueue: nextQueue.filter(snackbar => snackbar.key !== key),
        };
      }),

  }),
);

/**
 * This is here to quickly trace back to "unexpected" branches in the code
 */
export function addSnackUnexpected(userMessage: string) {
  if (process.env.NODE_ENV === 'development')
    console.warn(`[DEV] Unexpected branch reached: ${userMessage}`);
  return addSnackbar({ key: 'unexpected', message: userMessage, type: 'precondition-fail' });
}

export function addSnackbar(snackbar: SnackbarMessage) {
  return useSnackbarsStore.getState().addSnackbar(snackbar);
}

export function removeSnackbar(key: string) {
  return useSnackbarsStore.getState().removeSnackbar(key);
}