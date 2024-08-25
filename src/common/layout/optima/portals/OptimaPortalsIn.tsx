import * as React from 'react';
import { createPortal } from 'react-dom';

import { OptimaPortalId, useOptimaPortalsStore } from './store-optima-portals';


export function OptimaDrawerIn(props: { children: React.ReactNode }) {
  const portalElement = _useOptimaPortalTargetElement('optima-portal-drawer');
  return portalElement ? createPortal(props.children, portalElement) : null;
}

export function OptimaPanelIn(props: { children: React.ReactNode }) {
  const portalElement = _useOptimaPortalTargetElement('optima-portal-panel');
  return portalElement ? createPortal(props.children, portalElement) : null;
}

export function OptimaToolbarIn(props: { children: React.ReactNode }) {
  const portalElement = _useOptimaPortalTargetElement('optima-portal-toolbar');
  return portalElement ? createPortal(props.children, portalElement) : null;
}


/**
 * Hook to get the target element for a portal.
 */
function _useOptimaPortalTargetElement(targetPortalId: OptimaPortalId) {
  // get the output element
  const targetPortalEl = useOptimaPortalsStore(state => state.portals[targetPortalId]?.element ?? null);

  // increment/decrement input count
  React.useEffect(() => {
    const { incrementInputs, decrementInputs } = useOptimaPortalsStore.getState();
    incrementInputs(targetPortalId);
    return () => decrementInputs(targetPortalId);
  }, [targetPortalId]);

  // return the output element
  return targetPortalEl;
}
