import type { StateCreator } from 'zustand/vanilla';

import { agiUuid } from '~/common/util/idUtils';


// configuration
export const EPHEMERALS_DEFAULT_TIMEOUT = 6000;
const EPHEMERALS_DEFAULT_MINIMIZED = true;


/**
 * DEphemeral: For ReAct sidebars, displayed under the chat
 */
export interface DEphemeral {
  id: DEphemeralId;
  title: string;
  text: string;
  state: object;
  done: boolean;        // is complete, shall close after timeout
  minimized: boolean;   // collapsed to a single line
  showStatePane: boolean;   // show the state object
}

type DEphemeralId = string;

export function createDEphemeral(title: string, initialText: string): DEphemeral {
  return {
    id: agiUuid('chat-ephemerals-item'),
    title: title,
    text: initialText,
    state: {},
    done: false,
    minimized: lastMinimized,
    showStatePane: lastShowStatePane,
  };
}


/// Ephemerals Overlay Store ///

let lastMinimized = EPHEMERALS_DEFAULT_MINIMIZED;
let lastShowStatePane = false;

interface EphemeralsOverlayState {

  ephemerals: DEphemeral[];

}

export interface EphemeralsOverlayStore extends EphemeralsOverlayState {

  ephemeralsAppend: (ephemeral: DEphemeral) => void;
  ephemeralsDelete: (ephemeralId: DEphemeralId) => void;
  ephemeralsUpdate: (ephemeralId: DEphemeralId, update: Partial<DEphemeral>) => void;

  ephemeralsToggleMinimized: (ephemeralId: DEphemeralId) => void;
  ephemeralsToggleShowStatePane: (ephemeralId: DEphemeralId) => void;

  getEphemeral: (ephemeralId: DEphemeralId) => Readonly<DEphemeral> | undefined;

}


export const createEphemeralsOverlayStoreSlice: StateCreator<EphemeralsOverlayStore, [], [], EphemeralsOverlayStore> = (_set, _get) => ({

  // init state
  ephemerals: [],

  // actions
  ephemeralsAppend: (ephemeral) =>
    _set((state) => ({
      ephemerals: [...state.ephemerals, ephemeral],
    })),

  ephemeralsDelete: (ephemeralId) =>
    _set((state) => ({
      ephemerals: state.ephemerals.filter((e) => e.id !== ephemeralId),
    })),

  ephemeralsUpdate: (ephemeralId, update) =>
    _set((state) => {
      if (update.minimized !== undefined)
        lastMinimized = update.minimized;
      if (update.showStatePane !== undefined)
        lastShowStatePane = update.showStatePane;
      return {
        ephemerals: state.ephemerals.map((e) =>
          e.id === ephemeralId
            ? { ...e, ...update }
            : e,
        ),
      };
    }),

  ephemeralsToggleMinimized: (ephemeralId) => {
    const { ephemerals, ephemeralsUpdate } = _get();
    const ephemeral = ephemerals.find((e) => e.id === ephemeralId);
    if (ephemeral)
      ephemeralsUpdate(ephemeralId, { minimized: !ephemeral.minimized });
  },

  ephemeralsToggleShowStatePane: (ephemeralId) => {
    const { ephemerals, ephemeralsUpdate } = _get();
    const ephemeral = ephemerals.find((e) => e.id === ephemeralId);
    if (ephemeral)
      ephemeralsUpdate(ephemeralId, { showStatePane: !ephemeral.showStatePane });
  },

  getEphemeral: (ephemeralId) =>
    _get().ephemerals.find((e) => e.id === ephemeralId),

});
