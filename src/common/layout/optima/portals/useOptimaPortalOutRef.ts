import * as React from 'react';

import { OptimaPortalId, useLayoutPortalsStore } from './store-layout-portals';


/**
 * Defines a React output portal for a given target id. Will return a ref that
 * must be attached to the target element.
 *
 * Note: this hook assumes that the ref is created by when useLayoutEffect is called,
 * and will warn otherwise.
 *
 * If the ref is created after the layout effect, the portal will not be added. In
 * that case, consider returning a Callback instead, with:
 * `const setRef = React.useCallback((node: HTMLElement | null) => { ... }, [portalTargetId]);`
 */
export function useOptimaPortalOutRef(portalTargetId: OptimaPortalId, debugCallerName: string) {

  // state
  const ref = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    const { setElement } = useLayoutPortalsStore.getState();
    if (!ref.current) {
      console.warn(`useOptimaPortalOut: ref.current is null for type ${portalTargetId} (called by ${debugCallerName})`);
    } else {
      setElement(portalTargetId, ref.current);
    }
    return () => setElement(portalTargetId, null);
  }, [debugCallerName, portalTargetId]);

  return ref;
}
