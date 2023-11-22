import * as React from 'react';
import { create } from 'zustand';


export const SNACKBAR_ANIMATION_DURATION = 200;

export interface SnackbarMessage {
  key: string;
  message: string;
  type: 'success' | 'issue';
  autoHideDuration?: number | null;
  startDecorator?: React.ReactNode;
}

interface SnackbarStore {

  // state
  activeSnackbar: SnackbarMessage | null;
  activeSnackbarOpen: boolean;
  snackbarQueue: SnackbarMessage[];

  // actions
  addSnackbar: (snackbar: SnackbarMessage) => void;
  animateCloseSnackbar: () => void;
  closeSnackbar: () => void;

}


export const useSnackbarsStore = create<SnackbarStore>()(
  (_set, _get) => ({

    activeSnackbar: null,
    activeSnackbarOpen: true,
    snackbarQueue: [],

    addSnackbar: (snackbar: SnackbarMessage) =>
      _set((state) => {
        const newSnackbar = {
          ...snackbar,
          key: snackbar.key + '_' + new Date().getTime(),
        };
        if (state.activeSnackbar === null) {
          return {
            activeSnackbar: newSnackbar,
            activeSnackbarOpen: true,
          };
        } else {
          return {
            snackbarQueue: [...state.snackbarQueue, newSnackbar],
          };
        }
      }),

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

  }),
);

export const addSnackbar = (snackbar: SnackbarMessage) =>
  useSnackbarsStore.getState().addSnackbar(snackbar);