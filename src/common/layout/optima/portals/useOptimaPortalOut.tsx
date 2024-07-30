import * as React from 'react';

import { OptimaPortalId, optimaPortalsActions } from './store-optima-portals';


/**
 * Note: this hook assumes that the ref is created by when useLayoutEffect is called,
 * and will warn otherwise.
 */
export function useOptimaPortalOut(portalTargetId: OptimaPortalId, debugCallerName: string) {

  // state
  const ref = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    const { addPortal, removePortal } = optimaPortalsActions();
    if (!ref.current) {
      console.warn(`useOptimaPortalOut: ref.current is null for type ${portalTargetId} (called by ${debugCallerName})`);
    } else {
      addPortal(portalTargetId, ref.current);
    }
    return () => removePortal(portalTargetId);
  }, [debugCallerName, portalTargetId]);

  return ref;
}

/*
// This version will add the portal only when really getting the ref
export function useOptimaPortalOut(portalTargetId: OptimaPortalId, debugCallerName: string) {

  const setRef = React.useCallback((node: HTMLElement | null) => {
    const { addPortal, removePortal } = optimaPortalsActions();
    console.log('useOptimaPortalOut.setRef', portalTargetId, node);
    if (node) {
      console.log(' - useOptimaPortalOut call AddPortal', portalTargetId);
      addPortal(portalTargetId, node);
    } else {
      removePortal(portalTargetId);
    }
  }, [portalTargetId]);

  return setRef;
}
*/