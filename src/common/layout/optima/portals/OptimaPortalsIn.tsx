import * as React from 'react';
import { createPortal } from 'react-dom';

import { OptimaPortalId, useLayoutPortalsStore } from './store-layout-portals';
import { optimaActions } from '../useOptima';


const _drawerWrapperStyle = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
} as const;

export function OptimaDrawerIn(props: { children: React.ReactNode }) {
  const portalElement = useOptimaPortalTargetElement('optima-portal-drawer');
  if (!portalElement) return null;

  // wrap portal contents in a div that updates the hover state of the drawer
  const { peekDrawerEnter, peekDrawerLeave } = optimaActions();
  return createPortal(
    <div
      onMouseEnter={peekDrawerEnter}
      onMouseLeave={peekDrawerLeave}
      style={_drawerWrapperStyle}
    >
      {props.children}
    </div>, portalElement);
}

export function OptimaPanelIn(props: { children: React.ReactNode }) {
  const portalElement = useOptimaPortalTargetElement('optima-portal-panel');
  return portalElement ? createPortal(props.children, portalElement) : null;
}

export function OptimaToolbarIn(props: { children: React.ReactNode }) {
  const portalElement = useOptimaPortalTargetElement('optima-portal-toolbar');
  return portalElement ? createPortal(props.children, portalElement) : null;
}


/**
 * Hook to get the target element for a portal.
 */
function useOptimaPortalTargetElement(targetPortalId: OptimaPortalId) {
  // get the output element
  const targetPortalEl = useLayoutPortalsStore(state => state.portals[targetPortalId]?.element ?? null);

  // increment/decrement input count
  React.useEffect(() => {
    const { incrementInputs, decrementInputs } = useLayoutPortalsStore.getState();
    incrementInputs(targetPortalId);
    return () => decrementInputs(targetPortalId);
  }, [targetPortalId]);

  // return the output element
  return targetPortalEl;
}
