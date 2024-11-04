import { create } from 'zustand';


// configuration
const DEBUG_OPTIMA_PORTALS = false;


export type OptimaPortalId =
  | 'optima-portal-drawer'
  | 'optima-portal-panel'
  | 'optima-portal-toolbar';


interface OptimaPortalState {
  portals: Record<OptimaPortalId, {
    element: HTMLElement | null;
    inputs: number;
  }>;
}

interface OptimaPortalActions {

  // store output elements
  setElement: (id: OptimaPortalId, element: HTMLElement | null) => void;

  // reference counting
  incrementInputs: (id: OptimaPortalId) => void;
  decrementInputs: (id: OptimaPortalId) => void;

}


export const useLayoutPortalsStore = create<OptimaPortalState & OptimaPortalActions>((_set, _get) => ({

  // init state
  portals: {
    'optima-portal-drawer': { element: null, inputs: 0 },
    'optima-portal-panel': { element: null, inputs: 0 },
    'optima-portal-toolbar': { element: null, inputs: 0 },
  },

  // actions

  setElement: (id, element) => _set((state) => {
    // sanity check
    if (element && _get().portals[id].element)
      console.warn(`useOptimaPortalsStore.setElement: expected element to be null for ${id}`);
    if (DEBUG_OPTIMA_PORTALS)
      console.log(`${element ? 'Set' : 'Remove'} portal element`, id);
    return {
      portals: {
        ...state.portals,
        [id]: { ...state.portals[id], element: element },
      },
    };
  }),

  incrementInputs: (id) => _set((state) => {
    const newInputs = state.portals[id].inputs + 1;
    // sanity check
    if (newInputs > 1)
      console.warn(`useOptimaPortalsStore.incrementInputs: expected inputs to not exceed 1 for ${id}`);
    if (DEBUG_OPTIMA_PORTALS)
      console.log(' + store.incrementInputs', id, newInputs);
    return {
      portals: {
        ...state.portals,
        [id]: { ...state.portals[id], inputs: newInputs },
      },
    };
  }),

  decrementInputs: (id) => _set((state) => {
    const newInputs = Math.max(0, state.portals[id].inputs - 1);
    if (DEBUG_OPTIMA_PORTALS)
      console.log(' - store.decrementInputs', id, newInputs);
    return {
      portals: {
        ...state.portals,
        [id]: { ...state.portals[id], inputs: newInputs },
      },
    };
  }),

}));
