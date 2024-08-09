import type { StateCreator } from 'zustand/vanilla';

import { agiUuid } from '~/common/util/idUtils';


/**
 * DEphemeral: For ReAct sidebars, displayed under the chat
 */
export interface DEphemeral {
  id: DEphemeralId;
  title: string;
  text: string;
  state: object;
  done: boolean;
  pinned: boolean;
}

type DEphemeralId = string;

export function createDEphemeral(title: string, initialText: string): DEphemeral {
  return {
    id: agiUuid('chat-ephemerals-item'),
    title: title,
    text: initialText,
    state: {},
    done: false,
    pinned: lastEphemeralPinned,
  };
}


/// Ephemerals Overlay Store ///

let lastEphemeralPinned = false;

interface EphemeralsOverlayState {

  ephemerals: DEphemeral[];

}

export interface EphemeralsOverlayStore extends EphemeralsOverlayState {

  ephemeralsAppend: (ephemeral: DEphemeral) => void;
  ephemeralsDelete: (ephemeralId: DEphemeralId) => void;
  ephemeralsUpdate: (ephemeralId: DEphemeralId, update: Partial<DEphemeral>) => void;

  ephemeralsIsPinned: (ephemeralId: DEphemeralId) => boolean;
  ephemeralsTogglePinned: (ephemeralId: DEphemeralId) => void;

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
      if (update.pinned !== undefined)
        lastEphemeralPinned = update.pinned;
      return {
        ephemerals: state.ephemerals.map((e) =>
          e.id === ephemeralId
            ? { ...e, ...update }
            : e,
        ),
      };
    }),

  ephemeralsIsPinned: (ephemeralId) =>
    _get().ephemerals.find((e) => e.id === ephemeralId)?.pinned || false,

  ephemeralsTogglePinned: (ephemeralId) => {
    const { ephemerals, ephemeralsDelete, ephemeralsUpdate } = _get();
    const ephemeral = ephemerals.find((e) => e.id === ephemeralId);
    if (ephemeral) {
      if (ephemeral.pinned && ephemeral.done)
        ephemeralsDelete(ephemeralId);
      else
        ephemeralsUpdate(ephemeralId, { pinned: !ephemeral.pinned });
    }
  },

});
