import { OptimaPortalId, useOptimaPortalsStore } from './store-optima-portals';

export function useOptimaPortalHasInputs(portalTargetId: OptimaPortalId) {
  return useOptimaPortalsStore(state => state.portals[portalTargetId]?.inputs >= 1);
}
