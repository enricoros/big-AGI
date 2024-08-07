import * as React from 'react';

import { useOverlayStore } from './store-overlays';


export const OverlaysInsert: React.FC = () => {

  // external state
  const overlays = useOverlayStore(state => state.overlays);

  // Transient Overlays / Modals
  return overlays.map(({ id, component }) => (
    <React.Fragment key={id}>{component}</React.Fragment>
  ));
};
