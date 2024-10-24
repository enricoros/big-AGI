import { OptimaPortalId, useLayoutPortalsStore } from './store-layout-portals';

export function useOptimaPortalHasInputs(portalTargetId: OptimaPortalId) {
  return useLayoutPortalsStore(state => state.portals[portalTargetId]?.inputs >= 1);
}
