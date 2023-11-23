import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

import type { SnackbarTypeMap } from '@mui/joy';


export const SNACKBAR_ANIMATION_DURATION = 200;

export interface SnackbarMessage {
  key: string;
  message: string;
  type: 'success' | 'issue' | 'title';
  closeButton?: boolean,
  overrides?: Partial<SnackbarTypeMap['props']>;
}

interface SnackbarStore {

  // state
  activeSnackbar: SnackbarMessage | null;
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

    activeSnackbar: null,
    activeSnackbarOpen: true,
    snackbarQueue: [],

    addSnackbar: (snackbar: SnackbarMessage): string => {
      const { activeSnackbar } = _get();
      let { key, ...rest } = snackbar;

      // unique key
      key += '-' + uuidv4();

      // append the snackbar
      const newSnackbar = { key, ...rest };
      _set(activeSnackbar === null
        ? {
          activeSnackbar: newSnackbar,
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
          activeSnackbar: nextActiveSnackbar,
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
        let nextActiveSnackbar = state.activeSnackbar;
        let nextQueue = [...state.snackbarQueue];
        if (nextActiveSnackbar?.key === key) {
          if (nextQueue.length > 0)
            nextActiveSnackbar = nextQueue.shift() as SnackbarMessage; // Remove the first snackbar from the queue
          else
            nextActiveSnackbar = null;
          return {
            activeSnackbar: nextActiveSnackbar,
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

export const addSnackbar = (snackbar: SnackbarMessage) =>
  useSnackbarsStore.getState().addSnackbar(snackbar);

export const removeSnackbar = (key: string) =>
  useSnackbarsStore.getState().removeSnackbar(key);