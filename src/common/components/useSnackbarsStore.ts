import * as React from 'react';
import { create } from 'zustand';

import type { SnackbarTypeMap } from '@mui/joy';


export interface SnackbarMessage {
  key: string;
  message: string;
  type: 'success' | 'issue';
  startDecorator?: React.ReactNode;
}

interface SnackbarStore {

  // state
  activeSnackbar: SnackbarMessage | null;
  snackbarQueue: SnackbarMessage[];

  // actions
  addSnackbar: (snackbar: SnackbarMessage) => void;
  closeSnackbar: () => void;

}


export const useSnackbarsStore = create<SnackbarStore>()(
  (_set) => ({

    activeSnackbar: null,
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
          snackbarQueue: nextQueue,
        };
      }),

  }),
);

export const addSnackbar = (snackbar: SnackbarMessage) =>
  useSnackbarsStore.getState().addSnackbar(snackbar);