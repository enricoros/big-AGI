import * as React from 'react';
import { createPortal } from 'react-dom';

import { OptimaPortalId, usePortalElement } from './store-optima-portals';


export function OptimaPortalIn(props: {
  targetPortalId: OptimaPortalId;
  children: React.ReactNode;
}) {

  // react to the portal being made available
  const portalElement = usePortalElement(props.targetPortalId);
  if (!portalElement)
    return null;

  return createPortal(props.children, portalElement);
}
