import { create } from 'zustand';


// module configuration
const DEBUG_OPTIMA_PORTALS = false;


export type OptimaPortalId =
  | 'optima-portal-drawer'
  | 'optima-portal-properties'
  | 'optima-portal-toolbar'
  ;

interface PortalState {
  portalElements: Map<OptimaPortalId, HTMLElement>;
}

interface PortalActions {
  addPortal: (id: OptimaPortalId, element: HTMLElement) => void;
  removePortal: (id: OptimaPortalId) => void;
}

type PortalStore = PortalState & PortalActions;


const useOptimaPortalsStore = create<PortalStore>((set, get) => ({

  // init state
  portalElements: new Map(),

  // actions
  addPortal: (id, element) => set((state) => {
    const newPortals = new Map(state.portalElements);
    newPortals.set(id, element);
    if (DEBUG_OPTIMA_PORTALS)
      console.log(' > store.addPortal', id, !!element);
    return { portalElements: newPortals };
  }),

  removePortal: (id) => set((state) => {
    const newPortals = new Map(state.portalElements);
    newPortals.delete(id);
    if (DEBUG_OPTIMA_PORTALS)
      console.log(' < store.removePortal', id);
    return { portalElements: newPortals };
  }),

}));


export function optimaPortalsActions(): PortalActions {
  return useOptimaPortalsStore.getState();
}

export function usePortalElement(id: OptimaPortalId) {
  return useOptimaPortalsStore((state) => state.portalElements.get(id) || null);
}
